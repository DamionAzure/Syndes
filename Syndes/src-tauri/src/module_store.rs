// In-memory registry of modules the UI has loaded this session, keyed by
// `module.id`. `check_answer`/`score_submission` take a `module_id` (spec 01)
// rather than the whole module payload, so the core needs somewhere to look up
// that module's questions (and their salt + answer_hash) again without the UI
// ever having to round-trip hashes back through JS. Loading is the only way
// modules enter this store - nothing here reads from disk directly.

use crate::model::{AppError, Module};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Default)]
pub struct ModuleStore {
    modules: Mutex<HashMap<String, Module>>,
}

impl ModuleStore {
    pub fn insert(&self, module: Module) {
        let mut guard = self.modules.lock().expect("module store mutex poisoned");
        guard.insert(module.module.id.clone(), module);
    }

    /// Clone out the module for a given id. Modules are small (one quiz/lesson),
    /// so cloning out of the lock rather than holding a borrow across the
    /// command body keeps the mutex critical section tiny.
    pub fn get(&self, module_id: &str) -> Result<Module, AppError> {
        let guard = self.modules.lock().expect("module store mutex poisoned");
        guard
            .get(module_id)
            .cloned()
            .ok_or_else(|| AppError::ModuleNotFound(module_id.to_string()))
    }
}
