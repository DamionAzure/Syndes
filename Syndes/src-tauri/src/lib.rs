// Acassist Rust scoring core (spec 04). Owns module loading/validation, the one
// authoritative normalizer, and offline hashing/compare for the Tauri command
// boundary (spec 01). No network calls anywhere in this crate (spec 04 R5).

mod commands;
mod loader;
mod model;
mod module_store;
mod normalize;
mod salt;
mod scoring;
mod seal;

use module_store::ModuleStore;

// Re-exported ONLY for the `seal_fixture` dev example (cargo run --example
// seal_fixture), so that tool seals through the exact same normalizer + hasher
// as the app instead of a second implementation. Not used by any Tauri command.
#[doc(hidden)]
pub use normalize::normalize as normalize_for_fixture;
#[doc(hidden)]
pub use scoring::seal as seal_for_fixture;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(ModuleStore::default())
        .invoke_handler(tauri::generate_handler![
            commands::load_module,
            commands::check_answer,
            commands::score_submission,
            commands::normalize_answer,
            commands::seal_module,
            commands::seal_answer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// End-to-end proof of the spec 04 T4 checkpoint: the real shipped fixture file
// loads, validates, and scores correctly through the SAME loader + scoring path
// the Tauri commands use - fully offline, no webview, no network. This is the
// "wifi off -> load module -> answer -> scored on-device" guarantee as a test.
#[cfg(test)]
mod e2e {
    use crate::loader::load_module;
    use crate::model::{Module, Question};
    use crate::scoring::check;

    // The hand-authored fixture lives at the workspace root under Documents/.
    // Path is relative to this crate's manifest dir (src-tauri/).
    const FIXTURE: &str = "../../Documents/example.module.json";

    fn question<'a>(module: &'a Module, id: &str) -> &'a Question {
        module
            .quiz
            .as_ref()
            .expect("fixture has a quiz")
            .questions
            .iter()
            .find(|q| q.id == id)
            .unwrap_or_else(|| panic!("fixture has question {id}"))
    }

    #[test]
    fn fixture_loads_and_validates() {
        let module = load_module(FIXTURE).expect("fixture loads + validates");
        assert_eq!(module.module.id, "mod_science_photosynthesis_01");
        assert_eq!(module.quiz.as_ref().unwrap().questions.len(), 3);
    }

    #[test]
    fn fixture_scores_correct_answers() {
        let module = load_module(FIXTURE).expect("fixture loads");

        // Correct answers in different surface forms than sealed, to prove
        // normalization parity (case, whitespace, punctuation).
        let (c1, p1) = check(question(&module, "q1"), "  CARBON   dioxide! ").unwrap();
        assert!(c1 && p1 == 1, "q1 (multiple_choice) should score");

        let (c2, p2) = check(question(&module, "q2"), "chlorophyll").unwrap();
        assert!(c2 && p2 == 1, "q2 (identification) should score");

        let (c3, p3) = check(question(&module, "q3"), "True").unwrap();
        assert!(c3 && p3 == 1, "q3 (true_false) should score");
    }

    #[test]
    fn fixture_rejects_wrong_answers() {
        let module = load_module(FIXTURE).expect("fixture loads");
        let (c1, p1) = check(question(&module, "q1"), "oxygen").unwrap();
        assert!(!c1 && p1 == 0);
        let (c3, p3) = check(question(&module, "q3"), "False").unwrap();
        assert!(!c3 && p3 == 0);
    }
}
