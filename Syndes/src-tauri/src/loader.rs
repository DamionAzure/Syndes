// Module loading + validation (spec 00, spec 04 R6).
//
// Validation here enforces the same shape as `module.schema.json` for the
// pieces that matter to scoring correctness (locked contract strings, the
// three allowed question kinds, options required for MC/TF, absent for
// identification). It does not pull in a general JSON Schema validator crate -
// for a single, well-known schema the explicit checks below are easier to keep
// in sync with spec 00 and produce more specific `AppError`s for the UI than a
// generic "schema validation failed at /quiz/questions/2" message would.

use crate::model::{AppError, Module};
use std::fs;
use std::path::Path;

/// The only `schema_version` accepted for the event (spec 00: "Lock schema_version at 1.0").
const SUPPORTED_SCHEMA_VERSION: &str = "1.0";
/// The only hash algorithm for the event (spec 00 design.md).
const SUPPORTED_HASH_ALGO: &str = "SHA-256";
/// The exact contract string both seal and check must obey (spec 00 R3).
const SUPPORTED_NORMALIZATION: &str = "lowercase|trim|collapse-ws|strip-punct";
const KNOWN_QUESTION_KINDS: [&str; 3] = ["multiple_choice", "identification", "true_false"];
const OPTION_KINDS: [&str; 2] = ["multiple_choice", "true_false"];

/// Read, parse, and validate a module file from a local path (spec 01 `load_module`).
pub fn load_module(path: &str) -> Result<Module, AppError> {
    let raw = fs::read_to_string(Path::new(path))
        .map_err(|e| AppError::ModuleNotFound(format!("{path}: {e}")))?;

    let module: Module =
        serde_json::from_str(&raw).map_err(|e| AppError::ParseError(e.to_string()))?;

    validate(&module)?;
    Ok(module)
}

/// Validate the pieces of the contract that scoring depends on. Presentation-only
/// fields (title, subject, lesson block kinds) are intentionally left permissive -
/// renderers ignore unknown lesson block kinds safely per spec 00, and that
/// forward-compatibility is a design choice, not an oversight.
///
/// `pub(crate)` so the seal step (spec 03) can gate its output through the exact
/// same validation the student path loads against - one definition of "contract-valid".
pub(crate) fn validate(module: &Module) -> Result<(), AppError> {
    if module.schema_version != SUPPORTED_SCHEMA_VERSION {
        return Err(AppError::ValidationError(format!(
            "unsupported schema_version '{}', expected '{}'",
            module.schema_version, SUPPORTED_SCHEMA_VERSION
        )));
    }

    if module.module.id.trim().is_empty() {
        return Err(AppError::MissingField("module.id".to_string()));
    }
    if module.module.title.trim().is_empty() {
        return Err(AppError::MissingField("module.title".to_string()));
    }
    if module.module.module_type != "quiz" && module.module.module_type != "lesson" {
        return Err(AppError::ValidationError(format!(
            "module.type must be 'quiz' or 'lesson', got '{}'",
            module.module.module_type
        )));
    }

    let Some(quiz) = &module.quiz else {
        // A lesson-only module has nothing left to validate.
        return Ok(());
    };

    if quiz.hash_algo != SUPPORTED_HASH_ALGO {
        return Err(AppError::ValidationError(format!(
            "quiz.hash_algo must be '{}', got '{}'",
            SUPPORTED_HASH_ALGO, quiz.hash_algo
        )));
    }
    if quiz.normalization != SUPPORTED_NORMALIZATION {
        return Err(AppError::ValidationError(format!(
            "quiz.normalization must match the contract string '{}', got '{}'",
            SUPPORTED_NORMALIZATION, quiz.normalization
        )));
    }
    if quiz.questions.is_empty() {
        return Err(AppError::ValidationError(
            "quiz.questions must not be empty".to_string(),
        ));
    }

    for q in &quiz.questions {
        if !KNOWN_QUESTION_KINDS.contains(&q.kind.as_str()) {
            return Err(AppError::UnknownQuestionKind(q.kind.clone()));
        }
        if q.id.trim().is_empty() {
            return Err(AppError::MissingField(format!("question[{}].id", q.id)));
        }
        if q.salt.trim().is_empty() {
            return Err(AppError::MissingField(format!("question[{}].salt", q.id)));
        }
        if q.answer_hash.trim().is_empty() {
            return Err(AppError::MissingField(format!(
                "question[{}].answer_hash",
                q.id
            )));
        }

        let needs_options = OPTION_KINDS.contains(&q.kind.as_str());
        match &q.options {
            Some(opts) if needs_options => {
                if opts.len() < 2 {
                    return Err(AppError::ValidationError(format!(
                        "question[{}] ({}) requires at least 2 options",
                        q.id, q.kind
                    )));
                }
            }
            Some(_) if !needs_options => {
                return Err(AppError::ValidationError(format!(
                    "question[{}] (identification) must not carry options",
                    q.id
                )));
            }
            None if needs_options => {
                return Err(AppError::MissingField(format!(
                    "question[{}].options",
                    q.id
                )));
            }
            _ => {}
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{ModuleMeta, Question, Quiz};

    fn base_module() -> Module {
        Module {
            schema_version: "1.0".to_string(),
            module: ModuleMeta {
                id: "mod_1".to_string(),
                module_type: "quiz".to_string(),
                title: "Title".to_string(),
                subject: None,
                grade_level: None,
            },
            lesson: None,
            quiz: Some(Quiz {
                hash_algo: "SHA-256".to_string(),
                normalization: "lowercase|trim|collapse-ws|strip-punct".to_string(),
                questions: vec![Question {
                    id: "q1".to_string(),
                    kind: "identification".to_string(),
                    prompt: "p".to_string(),
                    options: None,
                    salt: "s".to_string(),
                    answer_hash: "h".to_string(),
                    points: 1,
                }],
            }),
        }
    }

    #[test]
    fn valid_module_passes() {
        assert!(validate(&base_module()).is_ok());
    }

    #[test]
    fn rejects_wrong_schema_version() {
        let mut m = base_module();
        m.schema_version = "2.0".to_string();
        assert!(matches!(validate(&m), Err(AppError::ValidationError(_))));
    }

    #[test]
    fn rejects_unknown_question_kind() {
        let mut m = base_module();
        if let Some(quiz) = &mut m.quiz {
            quiz.questions[0].kind = "matching".to_string();
        }
        assert!(matches!(
            validate(&m),
            Err(AppError::UnknownQuestionKind(_))
        ));
    }

    #[test]
    fn rejects_mc_without_options() {
        let mut m = base_module();
        if let Some(quiz) = &mut m.quiz {
            quiz.questions[0].kind = "multiple_choice".to_string();
            quiz.questions[0].options = None;
        }
        assert!(matches!(validate(&m), Err(AppError::MissingField(_))));
    }

    #[test]
    fn rejects_identification_with_options() {
        let mut m = base_module();
        if let Some(quiz) = &mut m.quiz {
            quiz.questions[0].options = Some(vec!["a".to_string()]);
        }
        assert!(matches!(validate(&m), Err(AppError::ValidationError(_))));
    }

    // --- additionalProperties agreement with module.schema.json -----------------
    // The schema locks module/lesson/quiz/question to additionalProperties:false,
    // but keeps the TOP LEVEL permissive (additionalProperties:true, e.g. `_note`).
    // These tests pin that the Rust parser now agrees on both counts.

    /// A top-level unknown key (like the fixture's `_note`) is accepted — the
    /// top-level object is forward-compatible by design.
    #[test]
    fn accepts_unknown_top_level_field() {
        let json = r#"{
            "schema_version": "1.0",
            "_note": "demo fixture note, ignored by the core",
            "module": { "id": "mod_1", "type": "lesson", "title": "T" }
        }"#;
        let module: Module = serde_json::from_str(json).expect("top-level extras are allowed");
        assert_eq!(module.module.id, "mod_1");
    }

    /// An unknown key INSIDE `module` is rejected at parse time (deny_unknown_fields),
    /// matching the schema's additionalProperties:false on that object.
    #[test]
    fn rejects_unknown_field_inside_module() {
        let json = r#"{
            "schema_version": "1.0",
            "module": { "id": "mod_1", "type": "lesson", "title": "T", "colour": "blue" }
        }"#;
        let parsed: Result<Module, _> = serde_json::from_str(json);
        assert!(parsed.is_err(), "stray key under `module` must be rejected");
    }

    /// An unknown key inside a `question` is rejected at parse time.
    #[test]
    fn rejects_unknown_field_inside_question() {
        let json = r#"{
            "schema_version": "1.0",
            "module": { "id": "mod_1", "type": "quiz", "title": "T" },
            "quiz": {
                "hash_algo": "SHA-256",
                "normalization": "lowercase|trim|collapse-ws|strip-punct",
                "questions": [{
                    "id": "q1", "kind": "identification", "prompt": "p",
                    "salt": "s", "answer_hash": "h", "points": 1,
                    "weight": 5
                }]
            }
        }"#;
        let parsed: Result<Module, _> = serde_json::from_str(json);
        assert!(
            parsed.is_err(),
            "stray key under a question must be rejected"
        );
    }
}
