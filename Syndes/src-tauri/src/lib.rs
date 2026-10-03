// Acassist Rust scoring core (spec 04). Owns module loading/validation, the one
// authoritative normalizer, and offline hashing/compare for the Tauri command
// boundary (spec 01). No network calls anywhere in this crate (spec 04 R5).

// Local session cache + offline role verification (SPEC B). Caches the role
// Supabase already decided and verifies it offline against cached JWKS keys. It
// NEVER decides a role, and the loose `role` column is never trusted without a
// signature verify. Owns the SQLite `cached_session` table.
mod auth;
mod commands;
// Teacher-side, ONLINE-ONLY Groq generation (spec 03). Deliberately NOT imported
// by loader/scoring/module_store - the student/offline path must never reach it.
mod groq;
mod loader;
mod model;
mod module_store;
mod normalize;
mod salt;
// Teacher-side, deterministic prompting scaffolds (spec 03 R6, the SHOULD task).
// Pure/offline, but TEACHER-SIDE: like groq, it is deliberately NOT imported by
// loader/scoring/module_store - the student/offline path must never reach it.
mod scaffold;
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

// Re-exported ONLY for the `live_groq` dev example (cargo run --example
// live_groq), a toolchain-side smoke test of the real teacher-side generation
// path WITHOUT the webview/frontend. Not used by any Tauri command; the commands
// call these through their own private modules.
#[doc(hidden)]
pub use groq::{generate_draft as generate_draft_for_smoke, GenerationRequest};
#[doc(hidden)]
pub use model::Module as ModuleForSmoke;
#[doc(hidden)]
pub use seal::seal_module as seal_module_for_smoke;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load the teacher-side .env (holds GROQ_API_KEY) so the online generation
    // path can read it via std::env::var (spec 03). dotenvy searches the current
    // dir and its parents, which finds Syndes/.env when running from src-tauri/.
    // Absence is NOT an error: student machines have no .env, and the offline
    // scoring path never reads the key - generate_module simply falls back to the
    // bundled fixture when the key is missing (spec 03 R4/R5). dotenvy never
    // overrides a variable already set in the real environment.
    let _ = dotenvy::dotenv();

    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
    }
    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ModuleStore::default())
        // Build the local session cache (SPEC B) in setup, where the app data dir
        // is resolvable. The DB lives under the OS app-data dir so it persists
        // across launches; the online-gate re-check URL comes from the Supabase
        // project env (Spec A seam), falling back to a disabled gate when absent
        // (which simply makes every verify-failure drop to Student read-only —
        // fail closed, never open).
        .setup(|app| {
            use tauri::Manager;

            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            let db_path = app
                .path()
                .app_data_dir()
                .map(|dir| {
                    // Ensure the directory exists before SQLite tries to create
                    // the file inside it.
                    let _ = std::fs::create_dir_all(&dir);
                    dir.join("session_cache.sqlite3")
                })
                .map(|p| p.to_string_lossy().to_string())
                // In the unlikely event the app-data dir cannot be resolved, use
                // an in-process path so the app still boots; the cache simply
                // won't persist. Never panic the app over the cache.
                .unwrap_or_else(|_| "session_cache.sqlite3".to_string());

            // The gate re-check endpoint is Spec A's contract. Read it from the
            // environment; when unset the gate is "unreachable" by construction,
            // so offline-style read-only behaviour applies until it is configured.
            let project = auth::project::ProjectConfig::configured().ok();
            let recheck_url = project
                .as_ref()
                .map(|p| p.account_access_url.clone())
                .unwrap_or_default();
            let publishable_key = project
                .as_ref()
                .map(|p| p.publishable_key.clone())
                .unwrap_or_default();
            let gate: Box<dyn auth::gate::OnlineGate + Send + Sync> =
                Box::new(auth::gate::SupabaseGate::new(recheck_url, publishable_key));

            match auth::session_store::SessionStore::open(&db_path) {
                Ok(store) => {
                    // Confirm the Rust_Core app-data tables (SPEC B Req 1.5/1.6).
                    // This is advisory at startup: the core still provisions those
                    // tables elsewhere, so a missing table is logged (naming each
                    // one) rather than aborting boot. The session cache itself is
                    // already migrated and usable regardless.
                    if let Err(e) = store.confirm_app_data_tables() {
                        eprintln!("auth: app-data tables not yet provisioned ({e})");
                    }
                    app.manage(auth::AuthState::new(store, gate));
                }
                Err(e) => {
                    // Surface the setup problem but do not crash: the auth
                    // commands will be absent/erroring, while the rest of the app
                    // (offline scoring) still runs.
                    eprintln!("auth: failed to open session cache ({e}); auth commands disabled");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_module,
            commands::check_answer,
            commands::score_submission,
            commands::normalize_answer,
            commands::seal_module,
            commands::seal_answer,
            commands::generate_module,
            commands::list_scaffolds,
            commands::generate_from_scaffold,
            commands::auth_online_login,
            commands::auth_resolve_role,
            commands::auth_logout,
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

    // The hand-authored fixture is tracked at the workspace root. Different
    // branches keep docs under different folder names (`Documents/` on the
    // backend branch, `docs/` on main after the frontend merge), so resolve
    // whichever exists instead of hardcoding one and breaking across merges.
    // Paths are relative to this crate's manifest dir (src-tauri/).
    fn fixture_path() -> &'static str {
        const CANDIDATES: [&str; 2] = [
            "../../Documents/example.module.json",
            "../../docs/example.module.json",
        ];
        CANDIDATES
            .into_iter()
            .find(|p| std::path::Path::new(p).exists())
            .expect("example.module.json fixture not found under Documents/ or docs/")
    }

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
        let module = load_module(fixture_path()).expect("fixture loads + validates");
        assert_eq!(module.module.id, "mod_science_photosynthesis_01");
        assert_eq!(module.quiz.as_ref().unwrap().questions.len(), 3);
    }

    #[test]
    fn fixture_scores_correct_answers() {
        let module = load_module(fixture_path()).expect("fixture loads");

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
        let module = load_module(fixture_path()).expect("fixture loads");
        let (c1, p1) = check(question(&module, "q1"), "oxygen").unwrap();
        assert!(!c1 && p1 == 0);
        let (c3, p3) = check(question(&module, "q3"), "False").unwrap();
        assert!(!c3 && p3 == 0);
    }
}
