// Groq module-generation client (spec 03 T2). TEACHER-SIDE, ONLINE-ONLY.
//
// This is the "easy case" lane (spec 03 R5): it turns a teacher's topic/source
// into a DRAFT module whose questions still carry PLAINTEXT answers, in memory
// only. The draft then flows straight into the existing seal step (seal.rs),
// which strips the plaintext and produces a contract-valid, shippable Module.
// Nothing here ever writes a draft (plaintext answers) to disk, logs an answer,
// or stores one - the draft lives only for the duration of the generate call.
//
// Isolation (spec 03 R5): this module MUST NOT be imported by or reachable from
// loader.rs / scoring.rs / module_store.rs - the student/offline scoring path.
// Groq is a bonus on the teacher side, never a dependency of scoring.
//
// Structure for testability: the pure logic (prompt building, request-body
// shaping, response parsing, draft-shape validation) is split from the single
// tiny network-touching function `call_groq`, so everything except the live HTTP
// call is unit-tested offline.

use crate::model::{AppError, DraftModule};
use serde::Deserialize;
use serde_json::{json, Value};

/// Groq model id, in ONE place so it is trivial to change (spec 03 T2).
const GROQ_MODEL: &str = "openai/gpt-oss-120b";

/// OpenAI-compatible chat-completions endpoint on Groq.
const GROQ_ENDPOINT: &str = "https://api.groq.com/openai/v1/chat/completions";

/// The locked contract constants (spec 00 R3, enforced by loader::validate). The
/// generated draft must carry exactly these, or the seal step would reject it;
/// we check them here too so a bad generation surfaces as GenerationError rather
/// than a later ValidationError from the seal path.
const CONTRACT_HASH_ALGO: &str = "SHA-256";
const CONTRACT_NORMALIZATION: &str = "lowercase|trim|collapse-ws|strip-punct";
const KNOWN_QUESTION_KINDS: [&str; 3] = ["multiple_choice", "identification", "true_false"];
const OPTION_KINDS: [&str; 2] = ["multiple_choice", "true_false"];

/// Teacher input for a generation request. `camelCase` so it is callable from JS
/// via `invoke("generate_module", { request: {...} })` (spec 01 boundary).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationRequest {
    /// The topic the teacher wants a module about (required).
    pub topic: String,
    pub subject: Option<String>,
    pub grade_level: Option<String>,
    /// Optional source material the teacher is authorized to use. Original
    /// content is generated from it - DepEd copyrighted materials are never
    /// reproduced (spec 03 design.md, honest framing).
    pub source_text: Option<String>,
    /// How many quiz questions to generate. Defaults applied in the prompt.
    pub num_questions: Option<u32>,
}

/// Build the strict system prompt that constrains the model to emit ONLY a JSON
/// object matching the DraftModule shape. Pure, no network.
///
/// Honest framing (spec 03 design.md): content is aligned to DepEd (MELC)
/// competencies, but copyrighted DepEd materials are NEVER reproduced or
/// redistributed - all content is original to the teacher's topic/source.
pub fn build_system_prompt(req: &GenerationRequest) -> String {
    let num_questions = req.num_questions.unwrap_or(3);
    format!(
        "You are an assistant that writes short, original learning modules for \
Philippine teachers. Align the content to the relevant DepEd MELC competency for \
the given topic, but DO NOT reproduce, quote, or redistribute any copyrighted \
DepEd learning materials - write entirely original content and examples.\n\n\
Return ONLY a single JSON object (no prose, no markdown fences) matching exactly \
this shape:\n\
{{\n\
  \"schema_version\": \"1.0\",\n\
  \"module\": {{ \"id\": string, \"type\": \"quiz\", \"title\": string, \"subject\": string, \"grade_level\": string }},\n\
  \"lesson\": {{ \"blocks\": [ {{ \"kind\": \"heading\"|\"paragraph\", \"text\": string }} ] }},\n\
  \"quiz\": {{\n\
    \"hash_algo\": \"{hash_algo}\",\n\
    \"normalization\": \"{normalization}\",\n\
    \"questions\": [ {{\n\
      \"id\": string,\n\
      \"kind\": \"multiple_choice\"|\"identification\"|\"true_false\",\n\
      \"prompt\": string,\n\
      \"options\": [string, ...],\n\
      \"answer\": string,\n\
      \"points\": integer\n\
    }} ]\n\
  }}\n\
}}\n\n\
Rules:\n\
- Generate exactly {num_questions} quiz questions.\n\
- Question ids MUST be stable and sequential: \"q1\", \"q2\", \"q3\", ...\n\
- Put the correct answer in the \"answer\" field (plaintext).\n\
- Include \"options\" ONLY for \"multiple_choice\" (>= 2 options) and \"true_false\" \
(exactly [\"True\", \"False\"]). For \"multiple_choice\" and \"true_false\" the \
\"answer\" MUST be exactly one of the options. OMIT \"options\" for \"identification\".\n\
- Keep hash_algo and normalization EXACTLY as shown above.\n\
- Keep prompts and answers non-empty.",
        hash_algo = CONTRACT_HASH_ALGO,
        normalization = CONTRACT_NORMALIZATION,
        num_questions = num_questions,
    )
}

/// Build the user message from the teacher's structured input. Pure, no network.
fn build_user_prompt(req: &GenerationRequest) -> String {
    let mut parts = vec![format!("Topic: {}", req.topic)];
    if let Some(subject) = &req.subject {
        parts.push(format!("Subject: {subject}"));
    }
    if let Some(grade) = &req.grade_level {
        parts.push(format!("Grade level: {grade}"));
    }
    if let Some(src) = &req.source_text {
        parts.push(format!(
            "Source material the teacher is authorized to use (base original content on it, do not copy it verbatim):\n{src}"
        ));
    }
    parts.join("\n")
}

/// Build the full chat-completions request body. Pure, no network. Uses
/// `response_format: { type: "json_object" }` so the model returns strict JSON.
pub fn build_request_body(req: &GenerationRequest) -> Value {
    json!({
        "model": GROQ_MODEL,
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": build_system_prompt(req) },
            { "role": "user", "content": build_user_prompt(req) }
        ]
    })
}

/// Parse the raw HTTP response body (an OpenAI-compatible chat completion) into a
/// DraftModule. Pure, no network: extracts `choices[0].message.content` (itself a
/// JSON string) and parses that inner JSON into a DraftModule. Any failure maps to
/// AppError::GenerationError. Never logs or echoes answer plaintext.
pub fn parse_generation_response(http_json: &str) -> Result<DraftModule, AppError> {
    let outer: Value = serde_json::from_str(http_json)
        .map_err(|e| AppError::GenerationError(format!("response was not valid JSON: {e}")))?;

    let content = outer
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or_else(|| {
            AppError::GenerationError("response missing choices[0].message.content".to_string())
        })?;

    let draft: DraftModule = serde_json::from_str(content).map_err(|e| {
        // Report the shape failure, not the content: the content carries plaintext
        // answers and must never be logged (spec 03 R2).
        AppError::GenerationError(format!("generated content was not a valid draft module: {e}"))
    })?;

    Ok(draft)
}

/// Validate the generated draft's shape before it reaches the seal step. Mirrors
/// the contract loader::validate enforces, but phrased as a GenerationError so a
/// bad model response is attributed to the (teacher-side, online) generator.
pub fn validate_draft_shape(draft: &DraftModule) -> Result<(), AppError> {
    if draft.schema_version != "1.0" {
        return Err(AppError::GenerationError(format!(
            "draft schema_version must be '1.0', got '{}'",
            draft.schema_version
        )));
    }
    if draft.module.id.trim().is_empty() {
        return Err(AppError::GenerationError("draft module.id is empty".to_string()));
    }
    if draft.module.title.trim().is_empty() {
        return Err(AppError::GenerationError("draft module.title is empty".to_string()));
    }

    let Some(quiz) = &draft.quiz else {
        return Err(AppError::GenerationError("draft has no quiz".to_string()));
    };

    if quiz.hash_algo != CONTRACT_HASH_ALGO {
        return Err(AppError::GenerationError(format!(
            "draft quiz.hash_algo must be '{CONTRACT_HASH_ALGO}', got '{}'",
            quiz.hash_algo
        )));
    }
    if quiz.normalization != CONTRACT_NORMALIZATION {
        return Err(AppError::GenerationError(format!(
            "draft quiz.normalization must be '{CONTRACT_NORMALIZATION}', got '{}'",
            quiz.normalization
        )));
    }
    if quiz.questions.is_empty() {
        return Err(AppError::GenerationError("draft quiz has no questions".to_string()));
    }

    for q in &quiz.questions {
        if !KNOWN_QUESTION_KINDS.contains(&q.kind.as_str()) {
            return Err(AppError::GenerationError(format!(
                "draft question[{}] has unknown kind '{}'",
                q.id, q.kind
            )));
        }
        if q.prompt.trim().is_empty() {
            return Err(AppError::GenerationError(format!(
                "draft question[{}] has an empty prompt",
                q.id
            )));
        }
        if q.answer.trim().is_empty() {
            return Err(AppError::GenerationError(format!(
                "draft question[{}] has an empty answer",
                q.id
            )));
        }

        if OPTION_KINDS.contains(&q.kind.as_str()) {
            match &q.options {
                Some(opts) => {
                    if opts.len() < 2 {
                        return Err(AppError::GenerationError(format!(
                            "draft question[{}] ({}) needs at least 2 options",
                            q.id, q.kind
                        )));
                    }
                    // The sealed answer must be one of the shown options, or the
                    // question is unanswerable (seal.rs enforces this too).
                    if !opts.iter().any(|opt| opt == &q.answer) {
                        return Err(AppError::GenerationError(format!(
                            "draft question[{}] answer is not among its options",
                            q.id
                        )));
                    }
                }
                None => {
                    return Err(AppError::GenerationError(format!(
                        "draft question[{}] ({}) is missing options",
                        q.id, q.kind
                    )));
                }
            }
        } else if q.options.is_some() {
            // identification must not carry options.
            return Err(AppError::GenerationError(format!(
                "draft question[{}] (identification) must not carry options",
                q.id
            )));
        }
    }

    Ok(())
}

/// The ONLY network-touching function: POST the body to Groq and return the raw
/// response body string. Uses the blocking client so the command stays sync.
/// Maps network errors and non-2xx responses to GenerationError. NEVER includes
/// the API key in any error or log.
fn call_groq(api_key: &str, body: &Value) -> Result<String, AppError> {
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(GROQ_ENDPOINT)
        .bearer_auth(api_key)
        .json(body)
        .send()
        .map_err(|e| {
            // reqwest's Error Display can include the URL but never the auth header,
            // so the key cannot leak here.
            AppError::GenerationError(format!("Groq request failed: {e}"))
        })?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| AppError::GenerationError(format!("could not read Groq response: {e}")))?;

    if !status.is_success() {
        return Err(AppError::GenerationError(format!(
            "Groq returned HTTP {}",
            status.as_u16()
        )));
    }

    Ok(text)
}

/// Orchestrate a generation: read the key from env, build the body, call Groq,
/// parse + validate the draft. Returns the in-memory DraftModule (with plaintext
/// answers) for the caller to immediately seal. ONLINE-ONLY, teacher-side.
pub fn generate_draft(req: GenerationRequest) -> Result<DraftModule, AppError> {
    // Key comes from the environment ONLY - never hardcoded, never committed.
    let api_key = std::env::var("GROQ_API_KEY")
        .ok()
        .filter(|k| !k.trim().is_empty())
        .ok_or_else(|| AppError::GenerationError("GROQ_API_KEY not set".to_string()))?;

    let body = build_request_body(&req);
    let raw = call_groq(&api_key, &body)?;
    let draft = parse_generation_response(&raw)?;
    validate_draft_shape(&draft)?;
    Ok(draft)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req() -> GenerationRequest {
        GenerationRequest {
            topic: "Photosynthesis".to_string(),
            subject: Some("Science".to_string()),
            grade_level: Some("elementary".to_string()),
            source_text: None,
            num_questions: Some(3),
        }
    }

    // A hardcoded, valid Groq chat-completion response whose message content is a
    // JSON string of a valid DraftModule. No network involved.
    fn sample_groq_response() -> String {
        let inner = json!({
            "schema_version": "1.0",
            "module": {
                "id": "mod_photosynthesis_demo",
                "type": "quiz",
                "title": "Photosynthesis Basics",
                "subject": "Science",
                "grade_level": "elementary"
            },
            "lesson": {
                "blocks": [
                    { "kind": "heading", "text": "What is Photosynthesis?" },
                    { "kind": "paragraph", "text": "Plants make food from sunlight." }
                ]
            },
            "quiz": {
                "hash_algo": "SHA-256",
                "normalization": "lowercase|trim|collapse-ws|strip-punct",
                "questions": [
                    {
                        "id": "q1",
                        "kind": "multiple_choice",
                        "prompt": "Which gas do plants take in?",
                        "options": ["Oxygen", "Carbon dioxide"],
                        "answer": "Carbon dioxide",
                        "points": 1
                    },
                    {
                        "id": "q2",
                        "kind": "identification",
                        "prompt": "Green pigment in leaves?",
                        "answer": "Chlorophyll",
                        "points": 1
                    }
                ]
            }
        })
        .to_string();

        json!({
            "id": "chatcmpl-xyz",
            "object": "chat.completion",
            "choices": [
                { "index": 0, "message": { "role": "assistant", "content": inner } }
            ]
        })
        .to_string()
    }

    #[test]
    fn request_body_has_model_json_format_and_messages() {
        let body = build_request_body(&req());
        assert_eq!(body["model"], GROQ_MODEL);
        assert_eq!(body["response_format"]["type"], "json_object");

        let messages = body["messages"].as_array().expect("messages is an array");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["role"], "system");
        assert_eq!(messages[1]["role"], "user");
        // The system prompt carries the locked contract strings and the shape.
        let system = messages[0]["content"].as_str().unwrap();
        assert!(system.contains(CONTRACT_NORMALIZATION));
        assert!(system.contains(CONTRACT_HASH_ALGO));
        // The user prompt carries the teacher's topic.
        assert!(messages[1]["content"].as_str().unwrap().contains("Photosynthesis"));
    }

    #[test]
    fn parse_valid_response_yields_expected_draft() {
        let draft = parse_generation_response(&sample_groq_response()).expect("parses");
        assert_eq!(draft.schema_version, "1.0");
        assert_eq!(draft.module.id, "mod_photosynthesis_demo");
        let quiz = draft.quiz.as_ref().expect("has quiz");
        assert_eq!(quiz.questions.len(), 2);
        assert_eq!(quiz.questions[0].id, "q1");
        assert_eq!(quiz.questions[0].answer, "Carbon dioxide");
        assert_eq!(quiz.questions[1].kind, "identification");
    }

    #[test]
    fn parse_rejects_malformed_inner_json() {
        // Well-formed outer envelope, but the content is not valid JSON.
        let bad = json!({
            "choices": [ { "message": { "content": "{ not json ]" } } ]
        })
        .to_string();
        assert!(matches!(
            parse_generation_response(&bad),
            Err(AppError::GenerationError(_))
        ));
    }

    #[test]
    fn parse_rejects_missing_content() {
        let bad = json!({ "choices": [] }).to_string();
        assert!(matches!(
            parse_generation_response(&bad),
            Err(AppError::GenerationError(_))
        ));
    }

    #[test]
    fn validate_accepts_a_good_draft() {
        let draft = parse_generation_response(&sample_groq_response()).unwrap();
        assert!(validate_draft_shape(&draft).is_ok());
    }

    #[test]
    fn validate_rejects_mc_answer_not_in_options() {
        let inner = json!({
            "schema_version": "1.0",
            "module": { "id": "m1", "type": "quiz", "title": "T" },
            "quiz": {
                "hash_algo": "SHA-256",
                "normalization": "lowercase|trim|collapse-ws|strip-punct",
                "questions": [ {
                    "id": "q1",
                    "kind": "multiple_choice",
                    "prompt": "Which gas?",
                    "options": ["Oxygen", "Nitrogen"],
                    "answer": "Carbon dioxide",
                    "points": 1
                } ]
            }
        })
        .to_string();
        let outer = json!({ "choices": [ { "message": { "content": inner } } ] }).to_string();
        let draft = parse_generation_response(&outer).unwrap();
        assert!(matches!(
            validate_draft_shape(&draft),
            Err(AppError::GenerationError(_))
        ));
    }
}
