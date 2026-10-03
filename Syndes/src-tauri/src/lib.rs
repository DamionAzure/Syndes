// Acassist Rust scoring core (spec 04). Owns module loading/validation, the one
// authoritative normalizer, and offline hashing/compare for the Tauri command
// boundary (spec 01). No network calls anywhere in this crate (spec 04 R5).

mod commands;
mod loader;
mod model;
mod module_store;
mod normalize;
mod scoring;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
