// Types for the shared module contract (spec 00) and the command boundary (spec 01).
// Module/* mirror the JSON file shape verbatim (snake_case) because they are a
// pass-through of file content to the UI. CheckResult/ScoreResult/Answer are the
// JS-facing IPC payloads and use camelCase to match spec 01's TS types exactly.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Module {
    pub schema_version: String,
    pub module: ModuleMeta,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lesson: Option<Lesson>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quiz: Option<Quiz>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleMeta {
    pub id: String,
    // "type" is a reserved word in Rust, so the field is `module_type` but the JSON
    // key stays "type" to match spec 00 exactly.
    #[serde(rename = "type")]
    pub module_type: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    // Presentation metadata only - NEVER consulted by scoring logic in this core (spec 00).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grade_level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lesson {
    pub blocks: Vec<Block>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub kind: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quiz {
    pub hash_algo: String,
    pub normalization: String,
    pub questions: Vec<Question>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Question {
    pub id: String,
    // Kept as a plain String (not a Rust enum) rather than letting serde reject
    // unknown kinds during parsing. That lets us surface a typed
    // AppError::UnknownQuestionKind at scoring time instead of a generic parse
    // failure at load time, which is the more legible error for the UI (spec 04 R6).
    pub kind: String,
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    pub salt: String,
    pub answer_hash: String,
    pub points: u32,
}

/// One submitted answer from the UI (spec 01).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Answer {
    pub question_id: String,
    pub raw_answer: String,
}

// --- Seal-step input types (spec 03, teacher/content lane) ---------------------
//
// These mirror Module/Quiz/Question but carry the PLAINTEXT `answer` instead of
// `salt` + `answer_hash`. They exist only as the INPUT to the seal step: the
// content lane (its Groq generator, or a hand-authored draft) builds a
// DraftModule with answers it knows, hands it to the core, and gets back a
// contract-valid, sealed Module with the plaintext stripped (spec 03 R2). The
// draft never touches disk from this core and the plaintext is never stored or
// logged - it lives only in memory for the duration of the seal call.

/// A module before sealing: same shape as the shipped module, but the quiz
/// carries draft questions with plaintext answers.
#[derive(Debug, Clone, Deserialize)]
pub struct DraftModule {
    pub schema_version: String,
    pub module: ModuleMeta,
    #[serde(default)]
    pub lesson: Option<Lesson>,
    #[serde(default)]
    pub quiz: Option<DraftQuiz>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DraftQuiz {
    pub hash_algo: String,
    pub normalization: String,
    pub questions: Vec<DraftQuestion>,
}

/// A question with its correct answer in the clear. The seal step reads
/// `answer`, produces `{salt, answer_hash}`, and drops `answer` from the output.
#[derive(Debug, Clone, Deserialize)]
pub struct DraftQuestion {
    pub id: String,
    pub kind: String,
    pub prompt: String,
    #[serde(default)]
    pub options: Option<Vec<String>>,
    /// The correct answer, plaintext. For MC/TF this must match one of `options`
    /// (checked at seal time). Dropped from the sealed output - never shipped.
    pub answer: String,
    pub points: u32,
}

/// Result of sealing a single answer (spec 03): the salt + hash the content lane
/// writes into the question, with the plaintext gone. Returned by `seal_answer`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SealedAnswer {
    pub salt: String,
    pub answer_hash: String,
}

/// Verdict for a single question. Carries no plaintext answer and no hash (spec 01 R2, R4).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub question_id: String,
    pub correct: bool,
    pub points: u32,
}

/// Batched verdict for a whole submission (spec 01).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreResult {
    pub correct_count: u32,
    pub total_count: u32,
    pub points_earned: u32,
    pub points_possible: u32,
    pub per_question: Vec<CheckResult>,
}

/// Typed, legible errors (spec 04 R6) - never a silent wrong score, never a panic.
/// The four variants named in spec 04's sketch are kept verbatim; QuestionNotFound and
/// ValidationError are added because the sketch's types don't cover "question id not
/// present in this module" or "module fails schema-shaped checks" and those are real,
/// expected failure modes that must not panic.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    ModuleNotFound(String),
    ParseError(String),
    UnknownQuestionKind(String),
    MissingField(String),
    QuestionNotFound(String),
    ValidationError(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::ModuleNotFound(m) => write!(f, "module not found: {m}"),
            AppError::ParseError(m) => write!(f, "module parse error: {m}"),
            AppError::UnknownQuestionKind(m) => write!(f, "unknown question kind: {m}"),
            AppError::MissingField(m) => write!(f, "missing field: {m}"),
            AppError::QuestionNotFound(m) => write!(f, "question not found: {m}"),
            AppError::ValidationError(m) => write!(f, "validation error: {m}"),
        }
    }
}

impl std::error::Error for AppError {}
