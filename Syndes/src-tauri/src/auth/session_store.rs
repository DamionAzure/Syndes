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
    /// Open (or create) the database at `path`, apply durability/concurrency
    /// pragmas, and run migrations (creates the `cached_session` table). Returns a
    /// `StorageError` only when a fresh database still cannot be opened (Req 8.3).
    ///
    /// Corruption self-recovery: the session cache is DISPOSABLE by design (losing
    /// it just forces the next login to happen online). So if opening or migrating
    /// an EXISTING file fails in a way that looks like on-disk corruption, we
    /// delete the file once and recreate it from scratch rather than leaving the
    /// app without a usable cache. This mirrors the "never panic the app over the
    /// cache" stance in `lib.rs`: a corrupt cache degrades to "no session"
    /// (Layer 1 floor), it does not take auth down.
    ///
    /// Confirming the Rust_Core app-data tables (Req 1.5/1.6) is a SEPARATE step
    /// (`confirm_app_data_tables`) rather than part of `open`, so that opening the
    /// session cache never fails just because the core's own app-data tables have
    /// not been provisioned yet. The caller runs the confirmation when those
    /// tables are expected to exist.
    pub fn open(path: &str) -> Result<SessionStore, AuthError> {
        match Self::open_at(path) {
            Ok(store) => Ok(store),
            // A corrupt or unreadable existing file: discard it and retry once on a
            // clean slate. If the retry also fails (e.g. the directory is truly
            // unwritable), surface that second error — there is nothing left to
            // recover.
            Err(_) if std::path::Path::new(path).exists() => {
                let _ = std::fs::remove_file(path);
                // Best-effort removal of WAL/SHM sidecars so a half-written WAL
                // cannot resurrect the corruption on reopen.
                let _ = std::fs::remove_file(format!("{path}-wal"));
                let _ = std::fs::remove_file(format!("{path}-shm"));
                Self::open_at(path)
            }
            Err(e) => Err(e),
        }
    }

    /// Open a file-backed store without the corruption-recovery retry: open the
    /// connection, apply pragmas, migrate. Used by `open` (which layers recovery
    /// on top).
    fn open_at(path: &str) -> Result<SessionStore, AuthError> {
        let conn = Connection::open(path)
            .map_err(|e| AuthError::StorageError(format!("open database: {e}")))?;
        let store = SessionStore {
            conn: std::sync::Mutex::new(conn),
        };
        store.configure()?;
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
        store.configure()?;
        store.migrate()?;
        Ok(store)
    }

    /// Apply connection pragmas that make the cache resilient under the
    /// WebView-plus-commands access pattern, without changing stored data:
    ///
    /// * `journal_mode=WAL` — readers never block the single writer, so a UI read
    ///   racing a login write will not hit `SQLITE_BUSY`. (On an in-memory DB this
    ///   is a no-op; SQLite keeps `memory` journaling.)
    /// * `busy_timeout=5000` — if a lock IS contended, wait up to 5s rather than
    ///   failing immediately.
    /// * `synchronous=NORMAL` — the safe pairing with WAL: durable across app
    ///   crashes, only at risk on OS/power loss, which for a rebuildable cache is
    ///   an acceptable trade for far fewer fsyncs.
    /// * `foreign_keys=ON` — defensive; the cache has no FKs today but this keeps
    ///   the connection correct if any are added.
    fn configure(&self) -> Result<(), AuthError> {
        let conn = self.lock()?;
        // WAL returns a row ("wal"); query_row consumes it. The rest are silent.
        conn.query_row("pragma journal_mode = WAL", [], |_| Ok(()))
            .map_err(|e| AuthError::StorageError(format!("set journal_mode: {e}")))?;
        conn.execute_batch(
            "pragma busy_timeout = 5000;
             pragma synchronous = NORMAL;
             pragma foreign_keys = ON;",
        )
        .map_err(|e| AuthError::StorageError(format!("set pragmas: {e}")))
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

    /// Delete every row whose token has already expired at `now` (Unix seconds),
    /// returning how many rows were removed. This is pure cache hygiene, NOT a
    /// trust decision: the verify layer already rejects an expired `exp`, so an
    /// un-pruned expired row is harmless — pruning just keeps the file from
    /// accumulating dead sessions and makes a stale cache obvious. A row with
    /// `token_exp == now` is kept (not yet strictly past). Safe to call anytime;
    /// on an empty table it removes nothing and returns 0.
    pub fn prune_expired(&self, now: i64) -> Result<usize, AuthError> {
        let conn = self.lock()?;
        conn.execute(
            "delete from cached_session where token_exp < ?1",
            params![now],
        )
        .map_err(|e| AuthError::StorageError(format!("prune expired sessions: {e}")))
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
        store
            .store_cached_session(&sample("u1", "student"))
            .unwrap();
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
        store
            .store_cached_session(&sample("u1", "teacher"))
            .unwrap();

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
        store
            .store_cached_session(&sample("u1", "student"))
            .unwrap();
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
                    assert!(
                        msg.contains(t),
                        "missing-table error should name {t}: {msg}"
                    );
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
                conn.execute(&format!("create table {t} (id text)"), [])
                    .unwrap();
            }
        }
        assert!(store.confirm_app_data_tables().is_ok());
    }

    #[test]
    fn prune_expired_removes_only_strictly_past_rows() {
        let store = SessionStore::open_in_memory().unwrap();
        // Three users with distinct expiries. (One row per user_id; different
        // ids so all three coexist.)
        let mut past = sample("u-past", "student");
        past.token_exp = 1_000;
        let mut boundary = sample("u-now", "student");
        boundary.token_exp = 2_000;
        let mut future = sample("u-future", "student");
        future.token_exp = 3_000;
        store.store_cached_session(&past).unwrap();
        store.store_cached_session(&boundary).unwrap();
        store.store_cached_session(&future).unwrap();

        // now == 2_000: the past row (1_000 < 2_000) goes; the boundary row
        // (2_000, not strictly past) and the future row stay.
        let removed = store.prune_expired(2_000).unwrap();
        assert_eq!(removed, 1);

        let conn = store.conn.lock().unwrap();
        let count: i64 = conn
            .query_row("select count(*) from cached_session", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2, "boundary and future rows must survive");
        let has_past: i64 = conn
            .query_row(
                "select count(*) from cached_session where user_id = 'u-past'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(has_past, 0, "the strictly-expired row must be gone");
    }

    #[test]
    fn prune_expired_on_empty_table_is_noop() {
        let store = SessionStore::open_in_memory().unwrap();
        assert_eq!(store.prune_expired(9_999).unwrap(), 0);
    }

    #[test]
    fn file_store_recovers_from_a_corrupt_database() {
        // Write garbage to a path, then open it: the corrupt file is discarded
        // and a fresh, usable cache is created in its place (disposable-cache
        // recovery). The store must be fully functional afterwards.
        let dir = std::env::temp_dir();
        let path = dir
            .join(format!(
                "syndes-sessioncache-test-{}.sqlite3",
                std::process::id()
            ))
            .to_string_lossy()
            .to_string();
        // Clean any leftover from a previous run.
        let _ = std::fs::remove_file(&path);
        std::fs::write(&path, b"this is not a sqlite database header at all").unwrap();

        let store = SessionStore::open(&path).expect("open must recover from corruption");
        // Fresh table => no session, and writes work.
        assert_eq!(store.load_cached_session().unwrap(), None);
        store
            .store_cached_session(&sample("u1", "teacher"))
            .unwrap();
        assert_eq!(
            store.load_cached_session().unwrap().unwrap().role,
            "teacher"
        );

        // Drop before cleanup so the connection (and WAL/SHM) is released.
        drop(store);
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(format!("{path}-wal"));
        let _ = std::fs::remove_file(format!("{path}-shm"));
    }

    #[test]
    fn file_store_opens_and_persists_across_reopen() {
        // Confirms the pragma/open path works for a real file and that data
        // written under WAL survives closing and reopening the store.
        let dir = std::env::temp_dir();
        let path = dir
            .join(format!(
                "syndes-sessioncache-persist-{}.sqlite3",
                std::process::id()
            ))
            .to_string_lossy()
            .to_string();
        let _ = std::fs::remove_file(&path);

        {
            let store = SessionStore::open(&path).unwrap();
            store.store_cached_session(&sample("u1", "admin")).unwrap();
        }
        {
            let store = SessionStore::open(&path).unwrap();
            let loaded = store.load_cached_session().unwrap().unwrap();
            assert_eq!(loaded.role, "admin");
            assert_eq!(loaded.user_id, "u1");
        }

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(format!("{path}-wal"));
        let _ = std::fs::remove_file(format!("{path}-shm"));
    }
}
