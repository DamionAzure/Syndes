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
    modules: Mutex<HashMap<(String, String), Module>>,
}

impl ModuleStore {
    pub fn insert(&self, account_id: &str, module: Module) {
        let mut guard = self.modules.lock().expect("module store mutex poisoned");
        guard.insert((account_id.to_string(), module.module.id.clone()), module);
    }

    /// Clone out the module for a given id. Modules are small (one quiz/lesson),
    /// so cloning out of the lock rather than holding a borrow across the
    /// command body keeps the mutex critical section tiny.
    pub fn get(&self, account_id: &str, module_id: &str) -> Result<Module, AppError> {
        let guard = self.modules.lock().expect("module store mutex poisoned");
        guard
            .get(&(account_id.to_string(), module_id.to_string()))
            .cloned()
            .ok_or_else(|| AppError::ModuleNotFound(module_id.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_loaded_module_is_only_visible_to_the_account_that_loaded_it() {
        let module = crate::loader::load_module("../../docs/example.module.json")
            .or_else(|_| crate::loader::load_module("../../Documents/example.module.json"))
            .unwrap();
        let module_id = module.module.id.clone();
        let store = ModuleStore::default();
        store.insert("account-a", module);
        assert!(store.get("account-a", &module_id).is_ok());
        assert!(matches!(
            store.get("account-b", &module_id),
            Err(AppError::ModuleNotFound(_))
        ));
    }
}
