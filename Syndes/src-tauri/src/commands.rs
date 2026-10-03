// Tauri command boundary (spec 01, spec 04 design.md). Signatures and payload
// shapes match spec 01's TS types verbatim so `invoke<...>("name", {...})` on
// the JS side lines up with these one-to-one.

use crate::loader;
use crate::model::{AppError, Answer, CheckResult, Module, ScoreResult};
use crate::module_store::ModuleStore;
use crate::normalize::normalize;
use crate::scoring;
use tauri::State;

/// Load + parse + validate a module file from a local path. Registers it in the
/// in-memory store (keyed by `module.id`) so later `check_answer`/
/// `score_submission` calls can look up salts/hashes by id, then returns the
/// module as-is for the UI to render. Hashes/salts travel back to JS because
/// they are already in the file (not secret) - the UI just treats them as opaque.
#[tauri::command]
pub fn load_module(path: String, store: State<'_, ModuleStore>) -> Result<Module, AppError> {
    let module = loader::load_module(&path)?;
    store.insert(module.clone());
    Ok(module)
}

/// Score ONE answer. Rust looks up the question's salt + answer_hash, normalizes
/// the raw input with the one authoritative normalizer, hashes, compares, and
/// returns only the verdict - never the plaintext answer or the hash (spec 01 R2).
#[tauri::command]
pub fn check_answer(
    module_id: String,
    question_id: String,
    raw_answer: String,
    store: State<'_, ModuleStore>,
) -> Result<CheckResult, AppError> {
    let module = store.get(&module_id)?;
    let quiz = module
        .quiz
        .as_ref()
        .ok_or_else(|| AppError::ValidationError(format!("module {module_id} has no quiz")))?;

    let question = quiz
        .questions
        .iter()
        .find(|q| q.id == question_id)
        .ok_or_else(|| AppError::QuestionNotFound(question_id.clone()))?;

    let (correct, points) = scoring::check(question, &raw_answer)?;
    Ok(CheckResult {
        question_id,
        correct,
        points,
    })
}

/// Batched convenience: same per-question logic as `check_answer`, run over a
/// whole submission in one round trip (spec 01).
#[tauri::command]
pub fn score_submission(
    module_id: String,
    answers: Vec<Answer>,
    store: State<'_, ModuleStore>,
) -> Result<ScoreResult, AppError> {
    let module = store.get(&module_id)?;
    let quiz = module
        .quiz
        .as_ref()
        .ok_or_else(|| AppError::ValidationError(format!("module {module_id} has no quiz")))?;

    let mut per_question = Vec::with_capacity(answers.len());
    let mut correct_count = 0u32;
    let mut points_earned = 0u32;

    for answer in &answers {
        let question = quiz
            .questions
            .iter()
            .find(|q| q.id == answer.question_id)
            .ok_or_else(|| AppError::QuestionNotFound(answer.question_id.clone()))?;

        let (correct, points) = scoring::check(question, &answer.raw_answer)?;
        if correct {
            correct_count += 1;
        }
        points_earned += points;
        per_question.push(CheckResult {
            question_id: answer.question_id.clone(),
            correct,
            points,
        });
    }

    let points_possible: u32 = quiz.questions.iter().map(|q| q.points).sum();

    Ok(ScoreResult {
        correct_count,
        total_count: quiz.questions.len() as u32,
        points_earned,
        points_possible,
        per_question,
    })
}

/// Exposed so the SEAL step (teacher/content lane, spec 03) normalizes through
/// this exact function instead of a second implementation. This is the only
/// command that ever sees a plaintext answer, and only because the teacher
/// lane already has it in memory pre-seal - it is never stored or logged here.
#[tauri::command]
pub fn normalize_answer(raw: String) -> String {
    normalize(&raw)
}
