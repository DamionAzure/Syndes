// Tauri command boundary (spec 01, spec 04 design.md). Signatures and payload
// shapes match spec 01's TS types verbatim so `invoke<...>("name", {...})` on
// the JS side lines up with these one-to-one.

use crate::groq::{self, GenerationRequest};
use crate::loader;
use crate::model::{
    AppError, Answer, CheckResult, DraftModule, Module, ScoreResult, SealedAnswer,
};
use crate::module_store::ModuleStore;
use crate::normalize::normalize;
use crate::scaffold::{self, Scaffold, ScaffoldChoice};
use crate::seal;
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
/// this exact function instead of a second implementation. One of the three
/// commands that sees a plaintext answer, and only because the teacher lane
/// already has it in memory pre-seal - it is never stored or logged here.
#[tauri::command]
pub fn normalize_answer(raw: String) -> String {
    normalize(&raw)
}

/// Seal a whole draft module (teacher/content lane, spec 03). Takes a draft
/// whose questions carry PLAINTEXT answers, returns a contract-valid module with
/// each answer replaced by `{salt, answer_hash}` and the plaintext dropped.
/// Sealing runs through the core's one normalizer + hash, so seal-time and
/// check-time can never drift (spec 03 R3). The returned module is safe to ship.
///
/// Plaintext is read only to compute hashes and is never stored or logged (R2).
#[tauri::command]
pub fn seal_module(draft: DraftModule) -> Result<Module, AppError> {
    seal::seal_module(draft)
}

/// Seal ONE answer for incremental authoring (spec 03). The content lane passes
/// a question id + its plaintext answer and gets back the `{salt, answerHash}`
/// to write into that question. Same seal path as `seal_module`, one at a time.
#[tauri::command]
pub fn seal_answer(question_id: String, plaintext_answer: String) -> Result<SealedAnswer, AppError> {
    seal::seal_answer(&question_id, &plaintext_answer)
}

// --- Teacher/content lane: online generation + guaranteed fallback (spec 03 T4) ---
//
// `generate_module` is TEACHER-SIDE and ONLINE (spec 03 R5). It tries a live Groq
// generation, seals the resulting draft through the core (plaintext dropped,
// spec 03 R2), and - crucially for the demo (spec 03 R4/R5) - NEVER fails: if the
// live call fails for ANY reason (missing key, network, bad response, invalid
// draft) it serves the known-good, pre-sealed fallback module instead. The live
// call is a bonus, never a dependency.

/// Candidate locations for the pre-generated fallback fixture, as paths relative
/// to the workspace root (one level above this crate's manifest dir). Different
/// branches keep the fixture under `docs/` vs `Documents/`, so resolve whichever
/// exists - same set of layouts the e2e test in lib.rs handles.
const FALLBACK_RELATIVE_CANDIDATES: [&str; 2] = [
    "docs/example.module.json",
    "Documents/example.module.json",
];

/// Load the known-good, pre-sealed fallback module (spec 03 R4). Resolves the
/// fixture across the `docs/`/`Documents/` layouts and runs it through the same
/// loader validation the student path uses, so the fallback is guaranteed valid.
///
/// Paths are anchored to CARGO_MANIFEST_DIR (the crate dir, baked in at compile
/// time) rather than the process CWD, so the fallback guarantee holds regardless
/// of where the app is launched from - not only when CWD happens to be src-tauri/
/// (review finding #2). The fixture lives at the OUTER workspace root, two levels
/// above the manifest dir: src-tauri -> Syndes(project) -> Syndes(workspace root).
fn load_fallback_module() -> Result<Module, AppError> {
    let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    // `..` twice to reach the workspace root; join normalizes without needing the
    // path to be canonicalized. If the ancestors are somehow missing we still fall
    // through to the not-found error below rather than panicking.
    let workspace_root = manifest_dir.join("..").join("..");

    let path = FALLBACK_RELATIVE_CANDIDATES
        .iter()
        .map(|rel| workspace_root.join(rel))
        .find(|p| p.exists())
        .ok_or_else(|| {
            AppError::ModuleNotFound(
                "fallback example.module.json not found under docs/ or Documents/".to_string(),
            )
        })?;
    loader::load_module(&path.to_string_lossy())
}

/// Pure fallback decision (spec 03 R4), split out so it is testable without a
/// live call: an `Ok` generation passes through; any `Err` yields the fallback.
fn resolve_generation(result: Result<Module, AppError>, fallback: Module) -> Module {
    match result {
        Ok(module) => module,
        Err(err) => {
            // Log a brief, NON-SENSITIVE note only: the typed error message never
            // contains the plaintext answer or the API key (see groq.rs). This is
            // the "fell back" breadcrumb, nothing more.
            eprintln!("generate_module: live generation failed, serving fallback module ({err})");
            fallback
        }
    }
}

/// The shared "request -> sealed Module, with the guaranteed fallback" path
/// (spec 03 T4). Factored out so EVERY teacher-side entry point - the free-form
/// `generate_module` and the scaffold-driven `generate_from_scaffold` - runs the
/// exact same live-generate -> seal -> fall-back-on-any-error logic. The fallback
/// guarantee is defined once here and cannot drift between the two commands.
///
/// Tries a live Groq generation and seals the draft into a contract-valid Module;
/// on ANY failure, returns the known-good pre-generated fallback instead. The
/// draft's plaintext answers never leave memory - they flow straight into the
/// seal step (spec 03 R2).
fn generate_module_from_request(request: GenerationRequest) -> Result<Module, AppError> {
    // The fallback must exist for the guarantee to hold; if even it cannot load,
    // that is a genuine setup error worth surfacing (not something to paper over).
    let fallback = load_fallback_module()?;

    let generated = groq::generate_draft(request).and_then(seal::seal_module);
    Ok(resolve_generation(generated, fallback))
}

/// Teacher-side generation (spec 03 T2/T4). Free-form topic/source in, sealed
/// contract-valid Module out, with the guaranteed fallback on any failure. Thin
/// wrapper over the shared `generate_module_from_request` helper.
#[tauri::command]
pub fn generate_module(request: GenerationRequest) -> Result<Module, AppError> {
    generate_module_from_request(request)
}

// --- Teacher/content lane: deterministic prompting scaffolds (spec 03 R6) ---------
//
// So a non-techy teacher never faces a blank prompt box: `list_scaffolds` hands
// the UI a fixed, ordered catalog of structured starting points, and
// `generate_from_scaffold` turns the teacher's pick (with optional overrides)
// into a GenerationRequest and runs it through the SAME generate+fallback path as
// `generate_module`. Teacher-side only; no student/offline reach.

/// Return the deterministic built-in scaffold catalog for the UI picker (spec 03
/// R6). Pure - same ordered set every call, no network, no I/O.
#[tauri::command]
pub fn list_scaffolds() -> Vec<Scaffold> {
    scaffold::builtin_scaffolds()
}

/// Teacher picks a scaffold (and may override topic/grade/count); this builds the
/// corresponding GenerationRequest and runs the SAME live-generate -> seal ->
/// guaranteed-fallback path as `generate_module` (spec 03 R6/R4). An unknown
/// scaffold id surfaces as a ValidationError BEFORE any generation is attempted.
#[tauri::command]
pub fn generate_from_scaffold(choice: ScaffoldChoice) -> Result<Module, AppError> {
    let request = scaffold::request_from_choice(&choice)?;
    generate_module_from_request(request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::ModuleMeta;

    fn dummy_generated_module() -> Module {
        Module {
            schema_version: "1.0".to_string(),
            module: ModuleMeta {
                id: "mod_generated_live".to_string(),
                module_type: "quiz".to_string(),
                title: "Live".to_string(),
                subject: None,
                grade_level: None,
            },
            lesson: None,
            quiz: None,
        }
    }

    #[test]
    fn fallback_loads_known_good_fixture() {
        let fallback = load_fallback_module().expect("fallback fixture loads + validates");
        assert_eq!(fallback.module.id, "mod_science_photosynthesis_01");
    }

    #[test]
    fn resolve_err_yields_fallback() {
        let fallback = load_fallback_module().expect("fallback loads");
        let resolved = resolve_generation(
            Err(AppError::GenerationError("boom".to_string())),
            fallback,
        );
        assert_eq!(resolved.module.id, "mod_science_photosynthesis_01");
    }

    #[test]
    fn resolve_ok_passes_through() {
        let fallback = load_fallback_module().expect("fallback loads");
        let resolved = resolve_generation(Ok(dummy_generated_module()), fallback);
        assert_eq!(resolved.module.id, "mod_generated_live");
    }
}
