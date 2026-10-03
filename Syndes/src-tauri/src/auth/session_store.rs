// auth::session_store — the ONLY module permitted to read or write the SQLite
// `cached_session` row (SPEC B Req 1). It is a dumb byte store: it loads and
// stores rows verbatim and makes NO trust decision. The `role` string it returns
// is the loose, attacker-writable column; callers MUST route it through
// `auth::verify` (or the online gate) before trusting it. Keeping all
// `cached_session` access behind this one module is what makes "no code branches
// on the loose role" auditable (Req 4.4).

use crate::auth::AuthError;
use rusqlite::{params, Connection, OptionalExtension};

/// The app-data tables the Rust core owns (SPEC B Req 1.5). The session store
/// only CONFIRMS these exist; it never creates or alters their shape.
const REQUIRED_APP_DATA_TABLES: [&str; 4] = ["modules", "attempts", "scores", "drafts"];

/// A raw `cached_session` row as stored on disk. UNTRUSTED input: `role` is a
/// convenience string copied from a once-verified token and may have been edited
/// on-device. Nothing may branch on `role` here (Req 1.4, 1.7).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CachedSession {
    pub user_id: String,
    pub email: String,
    /// CACHE ONLY — never trusted without a signature verify.
    pub role: String,
    /// The signed Supabase JWT = the source of role truth.
    pub access_token: String,
    /// Supabase public keys, fetched while online.
    pub jwks_cache: String,
    /// Unix seconds when the row was written.
    pub cached_at: i64,
    /// From the JWT `exp` claim.
    pub token_exp: i64,
}

/// Owns the SQLite connection and the `cached_session` table. The connection is
/// behind a mutex so the single Tauri-managed instance can be shared across
/// commands (mirrors `ModuleStore`'s interior-mutability pattern).
pub struct SessionStore {
    conn: std::sync::Mutex<Connection>,
}

impl SessionStore {
    /// Open (or create) the database at `path` and run migrations (creates the
    /// `cached_session` table). Returns a `StorageError` on any SQLite failure
    /// (Req 8.3).
    ///
    /// Confirming the Rust_Core app-data tables (Req 1.5/1.6) is a SEPARATE step
    /// (`confirm_app_data_tables`) rather than part of `open`, so that opening the
    /// session cache never fails just because the core's own app-data tables have
    /// not been provisioned yet. The caller runs the confirmation when those
    /// tables are expected to exist.
    pub fn open(path: &str) -> Result<SessionStore, AuthError> {
        let conn = Connection::open(path)
            .map_err(|e| AuthError::StorageError(format!("open database: {e}")))?;
        let store = SessionStore {
            conn: std::sync::Mutex::new(conn),
        };
        store.migrate()?;
        Ok(store)
    }

    /// In-memory store for tests. Creates the `cached_session` table but, since a
    /// fresh in-memory DB has no app-data tables, callers that need the
    /// confirmation path should create them first.
    #[cfg(test)]
    pub fn open_in_memory() -> Result<SessionStore, AuthError> {
        let conn = Connection::open_in_memory()
            .map_err(|e| AuthError::StorageError(format!("open in-memory database: {e}")))?;
        let store = SessionStore {
            conn: std::sync::Mutex::new(conn),
        };
        store.migrate()?;
        Ok(store)
    }

    /// Create the `cached_session` table if absent. The schema matches the design
    /// verbatim, including the `role` check constraint that bounds the column to
    /// `student|teacher|admin` at the storage layer (Req 1.1, 1.2). `user_id` is
    /// the primary key, which gives us the single-row-per-user guarantee (Req 1.4)
    /// via upsert.
    fn migrate(&self) -> Result<(), AuthError> {
        let conn = self.lock()?;
        conn.execute_batch(
            "create table if not exists cached_session (
                 user_id       text primary key,
                 email         text not null,
                 role          text not null check (role in ('student','teacher','admin')),
                 access_token  text not null,
                 jwks_cache    text not null,
                 cached_at     integer not null,
                 token_exp     integer not null
             );",
        )
        .map_err(|e| AuthError::StorageError(format!("migrate cached_session: {e}")))
    }

    /// Confirm the Rust_Core app-data tables exist without touching their shape
    /// (Req 1.5). On any missing table, return a `StorageError` naming EVERY
    /// missing table and modify no schema (Req 1.6). Public API: callers run this
    /// when the core's app-data tables are expected to be provisioned.
    pub fn confirm_app_data_tables(&self) -> Result<(), AuthError> {
        let conn = self.lock()?;
        let mut missing = Vec::new();
        for table in REQUIRED_APP_DATA_TABLES {
            let exists: Option<String> = conn
                .query_row(
                    "select name from sqlite_master where type='table' and name=?1",
                    params![table],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| AuthError::StorageError(format!("probe table {table}: {e}")))?;
            if exists.is_none() {
                missing.push(table);
            }
        }
        if missing.is_empty() {
            Ok(())
        } else {
            Err(AuthError::StorageError(format!(
                "missing required app-data tables: {}",
                missing.join(", ")
            )))
        }
    }

    /// Upsert the session, keyed by `user_id` (Req 1.4): writing a session for an
    /// existing `user_id` REPLACES the prior row rather than duplicating it. An
    /// out-of-range `role` is rejected by the check constraint and surfaces as a
    /// `StorageError`, leaving any prior row unchanged (Req 1.3) because the
    /// single-statement upsert is atomic. Called ONLY after a successful verify
    /// (`auth::seam` is the sole caller).
    pub fn store_cached_session(&self, session: &CachedSession) -> Result<(), AuthError> {
        let conn = self.lock()?;
        conn.execute(
            "insert into cached_session
                 (user_id, email, role, access_token, jwks_cache, cached_at, token_exp)
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             on conflict(user_id) do update set
                 email        = excluded.email,
                 role         = excluded.role,
                 access_token = excluded.access_token,
                 jwks_cache   = excluded.jwks_cache,
                 cached_at    = excluded.cached_at,
                 token_exp    = excluded.token_exp",
            params![
                session.user_id,
                session.email,
                session.role,
                session.access_token,
                session.jwks_cache,
                session.cached_at,
                session.token_exp,
            ],
        )
        .map(|_| ())
        .map_err(|e| AuthError::StorageError(format!("store cached_session: {e}")))
    }

    /// Load the single cached session, if one exists. Returns the raw stored
    /// values verbatim with NO verification or trust decision (Req 1.9). A missing
    /// row is `Ok(None)` — not an error, no row created (Req 1.10). This store is
    /// a single-row-per-user cache; in practice there is one logged-in user per
    /// device, so this loads the most recently cached session.
    pub fn load_cached_session(&self) -> Result<Option<CachedSession>, AuthError> {
        let conn = self.lock()?;
        conn.query_row(
            "select user_id, email, role, access_token, jwks_cache, cached_at, token_exp
             from cached_session
             order by cached_at desc
             limit 1",
            [],
            |row| {
                Ok(CachedSession {
                    user_id: row.get(0)?,
                    email: row.get(1)?,
                    role: row.get(2)?,
                    access_token: row.get(3)?,
                    jwks_cache: row.get(4)?,
                    cached_at: row.get(5)?,
                    token_exp: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|e| AuthError::StorageError(format!("load cached_session: {e}")))
    }

    /// Clear every cached session (logout / corruption recovery). After this the
    /// resolver falls to the Layer 1 floor until the next online login.
    pub fn clear_cached_session(&self) -> Result<(), AuthError> {
        let conn = self.lock()?;
        conn.execute("delete from cached_session", [])
            .map(|_| ())
            .map_err(|e| AuthError::StorageError(format!("clear cached_session: {e}")))
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AuthError> {
        self.conn
            .lock()
            .map_err(|_| AuthError::StorageError("session store mutex poisoned".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(user_id: &str, role: &str) -> CachedSession {
        CachedSession {
            user_id: user_id.to_string(),
            email: "teacher@example.com".to_string(),
            role: role.to_string(),
            access_token: "header.payload.sig".to_string(),
            jwks_cache: "{\"keys\":[]}".to_string(),
            cached_at: 1_700_000_000,
            token_exp: 1_900_000_000,
        }
    }

    #[test]
    fn load_missing_returns_none_without_error() {
        let store = SessionStore::open_in_memory().unwrap();
        // Req 1.10: no row => Ok(None), no row created, no error.
        assert_eq!(store.load_cached_session().unwrap(), None);
    }

    #[test]
    fn upsert_replaces_row_for_same_user_no_duplicates() {
        let store = SessionStore::open_in_memory().unwrap();
        store.store_cached_session(&sample("u1", "student")).unwrap();
        let mut updated = sample("u1", "teacher");
        updated.email = "new@example.com".to_string();
        store.store_cached_session(&updated).unwrap();

        // Req 1.4: still a single row, now carrying the updated values.
        let loaded = store.load_cached_session().unwrap().unwrap();
        assert_eq!(loaded.user_id, "u1");
        assert_eq!(loaded.role, "teacher");
        assert_eq!(loaded.email, "new@example.com");

        let conn = store.conn.lock().unwrap();
        let count: i64 = conn
            .query_row("select count(*) from cached_session", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "upsert must not create a duplicate row");
    }

    #[test]
    fn invalid_role_rejected_and_prior_row_unchanged() {
        let store = SessionStore::open_in_memory().unwrap();
        store.store_cached_session(&sample("u1", "teacher")).unwrap();

        // Req 1.3: an out-of-range role is rejected by the check constraint.
        let bad = sample("u1", "superuser");
        let err = store.store_cached_session(&bad).unwrap_err();
        assert!(matches!(err, AuthError::StorageError(_)));

        // The prior row is untouched.
        let loaded = store.load_cached_session().unwrap().unwrap();
        assert_eq!(loaded.role, "teacher");
    }

    #[test]
    fn load_returns_raw_values_verbatim() {
        let store = SessionStore::open_in_memory().unwrap();
        // Even a role that would be absurd to trust is returned verbatim — the
        // store applies NO trust decision (Req 1.9). ('admin' is a valid column
        // value; the point is the store does not interpret it.)
        store.store_cached_session(&sample("u1", "admin")).unwrap();
        let loaded = store.load_cached_session().unwrap().unwrap();
        assert_eq!(loaded.role, "admin");
        assert_eq!(loaded.access_token, "header.payload.sig");
    }

    #[test]
    fn clear_removes_the_session() {
        let store = SessionStore::open_in_memory().unwrap();
        store.store_cached_session(&sample("u1", "student")).unwrap();
        store.clear_cached_session().unwrap();
        assert_eq!(store.load_cached_session().unwrap(), None);
    }

    #[test]
    fn confirm_app_data_tables_reports_each_missing_by_name() {
        let store = SessionStore::open_in_memory().unwrap();
        // Fresh in-memory DB has none of the app-data tables.
        let err = store.confirm_app_data_tables().unwrap_err();
        match err {
            AuthError::StorageError(msg) => {
                for t in REQUIRED_APP_DATA_TABLES {
                    assert!(msg.contains(t), "missing-table error should name {t}: {msg}");
                }
            }
            other => panic!("expected StorageError, got {other:?}"),
        }
    }

    #[test]
    fn confirm_app_data_tables_ok_when_all_present() {
        let store = SessionStore::open_in_memory().unwrap();
        {
            let conn = store.conn.lock().unwrap();
            for t in REQUIRED_APP_DATA_TABLES {
                conn.execute(&format!("create table {t} (id text)"), []).unwrap();
            }
        }
        assert!(store.confirm_app_data_tables().is_ok());
    }
}
