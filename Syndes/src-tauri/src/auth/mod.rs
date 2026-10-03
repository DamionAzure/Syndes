// Local session cache + offline role verification (SPEC B — SQLite Local).
//
// ONE-SENTENCE JOB: this module CACHES the role Supabase already decided and
// owns genuinely-local app data. It NEVER decides a role. When the trusted path
// fails, it fails TOWARD the stricter online check (the gate), never toward
// trusting the loose on-device `role` column.
//
// THE LEAK THIS CLOSES: the SQLite file lives on the user's device, so anyone can
// open it and set `role = 'admin'`. Therefore a role read from SQLite is ONLY
// valid when the accompanying signed Supabase JWT verifies. The loose `role`
// string is a display convenience; the SIGNATURE is the proof. No code path in
// this crate branches on the loose column without a signature verify or a live
// online-gate confirmation.
//
// MODULAR BUILD ORDER (do not invert):
//   Layer 1 (the FLOOR) = `gate` — online re-check, zero crypto. Privileged
//     actions require being online; offline => Student read-only. A secure app
//     with no cryptography at all.
//   Layer 2 (removable enhancement) = `verify` — offline JWT verify against
//     cached JWKS, layered ON TOP of Layer 1. Delete it and the gate still holds.
//
// The grace fallback composes them, strictly descending: offline verify ->
// online gate -> Student read-only. Never looser.

use serde::Serialize;

pub mod gate;
pub mod seam;
pub mod session_store;
pub mod verify;

/// The three roles Supabase can assign. This is the ONLY trusted role type; it
/// is produced solely from a verified token's `role` claim (never parsed from the
/// loose `cached_session.role` column for a trust decision).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Student,
    Teacher,
    Admin,
}

impl Role {
    /// The canonical lowercase string, matching the `cached_session.role` check
    /// constraint (`student|teacher|admin`). Used ONLY to cache a display string
    /// after a successful verify — never read back for a trust decision.
    pub fn as_str(self) -> &'static str {
        match self {
            Role::Student => "student",
            Role::Teacher => "teacher",
            Role::Admin => "admin",
        }
    }

    /// Parse a role string from a verified token claim. Rejects anything outside
    /// the three permitted values with `MalformedToken`, so an unexpected claim
    /// can never silently widen access.
    pub fn from_claim(s: &str) -> Result<Role, AuthError> {
        match s {
            "student" => Ok(Role::Student),
            "teacher" => Ok(Role::Teacher),
            "admin" => Ok(Role::Admin),
            other => Err(AuthError::MalformedToken(format!(
                "role claim is not one of student|teacher|admin: {other}"
            ))),
        }
    }

    /// True when this role is Teacher or Admin — i.e. may perform a
    /// Privileged_Action. Student is never privileged.
    pub fn is_privileged(self) -> bool {
        matches!(self, Role::Teacher | Role::Admin)
    }
}

/// The claims read ONLY after a token's signature and `exp` have been verified.
/// Nothing outside a successful `verify::verify_jwt` constructs this.
#[derive(Debug, Clone)]
pub struct VerifiedClaims {
    pub sub: String,
    pub email: String,
    pub role: Role,
    pub exp: i64,
}

/// Where a resolved access decision came from — its provenance. The UI scopes
/// itself by `role`/`read_only`; `source` explains why. camelCase at the IPC
/// boundary to match the existing command payload convention (spec 01).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AuthSource {
    /// Layer 2 at login time: token verified against freshly fetched keys.
    OnlineVerified,
    /// Layer 2 at app start / privileged action: token verified offline.
    OfflineVerified,
    /// Layer 1 fallback: the online gate re-confirmed the role.
    OnlineGate,
    /// The floor: offline and unverifiable => Student read-only, "Connect to
    /// continue".
    StudentReadOnly,
}

/// What a resolved access decision looks like to the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthContext {
    /// Effective role to scope the UI.
    pub role: Role,
    /// True in the Student-read-only fallback (offline + unverifiable).
    pub read_only: bool,
    /// Provenance of this decision.
    pub source: AuthSource,
}

/// Typed, legible auth failures, mirroring the existing `AppError` style in
/// `model.rs` (serde `tag = "kind"`, `content = "message"`). Every failure maps
/// to exactly ONE of these — never a panic, never a silent trust. No message
/// ever carries the access token, JWKS material, or decoded claims (Req 8.4).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AuthError {
    /// No `cached_session` row exists (never logged in on this device yet).
    NoCachedSession(String),
    /// `jwks_cache` is present but could not be parsed into public keys.
    JwksParseError(String),
    /// Token signature did not match the selected JWKS key.
    SignatureInvalid(String),
    /// Token `exp` has passed on the device clock (beyond skew tolerance).
    TokenExpired(String),
    /// Token could not be decoded, or a required claim is missing/invalid.
    MalformedToken(String),
    /// `jwks_cache` is empty — login happened without a completed JWKS fetch.
    MissingJwks(String),
    /// SQLite I/O failure. Treated by the resolver as "no session" (floor).
    StorageError(String),
    /// JWKS fetch / online gate could not reach the network.
    NetworkError(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::NoCachedSession(m) => write!(f, "no cached session: {m}"),
            AuthError::JwksParseError(m) => write!(f, "jwks parse error: {m}"),
            AuthError::SignatureInvalid(m) => write!(f, "signature invalid: {m}"),
            AuthError::TokenExpired(m) => write!(f, "token expired: {m}"),
            AuthError::MalformedToken(m) => write!(f, "malformed token: {m}"),
            AuthError::MissingJwks(m) => write!(f, "missing jwks: {m}"),
            AuthError::StorageError(m) => write!(f, "storage error: {m}"),
            AuthError::NetworkError(m) => write!(f, "network error: {m}"),
        }
    }
}

impl std::error::Error for AuthError {}

/// Current unix time in seconds, the sole `exp` truth while offline (the
/// Device_Clock). Isolated here so tests can reason about it and so there is one
/// definition of "now" across the auth path.
pub(crate) fn device_now() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        // A clock before the epoch is absurd; treat it as 0 so `exp` checks
        // fail CLOSED (everything looks expired) rather than open.
        .unwrap_or(0)
}

/// Clock-skew tolerance (seconds) applied when checking `exp` offline. Offline,
/// the device clock is the only truth and may drift; this small grace keeps a
/// barely-expired token from flapping. Spec A sets a generous (days) lifetime so
/// this is a safety margin, not a crutch. A token past `exp + tolerance` is
/// treated as expired (fail closed).
pub(crate) const CLOCK_SKEW_TOLERANCE_SECS: i64 = 60;

// --- Orchestrator: compose Layer 2 -> Layer 1 -> floor (SPEC B Req 4, 6) ------
//
// The grace fallback lives in exactly ONE place (`resolve_access`) so it cannot
// drift. It is a strictly-descending ladder, failing TOWARD more verification:
//   offline verify (OfflineVerified) -> online gate (OnlineGate) -> Student
//   read-only (StudentReadOnly, "Connect to continue").
// It NEVER derives a role from the loose `cached_session.role` column, and never
// falls open (Req 4.1, 4.4, 6.4).

use crate::auth::gate::{GateOutcome, OnlineGate};
use crate::auth::session_store::SessionStore;

/// Tauri-managed auth state: the session store (Layer 1 data + Layer 2 input) and
/// the online gate (Layer 1 enforcement). Held behind Tauri's `State`.
pub struct AuthState {
    pub store: SessionStore,
    pub gate: Box<dyn OnlineGate + Send + Sync>,
}

impl AuthState {
    pub fn new(store: SessionStore, gate: Box<dyn OnlineGate + Send + Sync>) -> AuthState {
        AuthState { store, gate }
    }
}

/// The trusted check (SPEC B Req 3 shape): load the raw row, then verify. Trusts
/// ONLY the in-token role returned by `verify_jwt`, never `session.role`. A
/// missing row is `NoCachedSession` — the first cause in the fixed order.
pub(crate) fn verify_cached_role(store: &SessionStore) -> Result<VerifiedClaims, AuthError> {
    let session = store
        .load_cached_session()?
        .ok_or_else(|| AuthError::NoCachedSession("no cached session on this device".to_string()))?;
    // The loose `session.role` is deliberately IGNORED here; the role is read
    // only from the verified token inside verify_jwt.
    verify::verify_jwt(&session.access_token, &session.jwks_cache)
}

/// Resolve the caller's effective access — the single home of the grace fallback
/// (Req 4, 6). `require_privileged` indicates the caller is attempting a
/// Teacher/Admin action.
///
/// Ladder (strictly descending, never looser):
///   1. Layer 2 offline verify succeeds  => OfflineVerified (full trusted role).
///   2. verify fails (any cause)          => Layer 1 online gate re-check.
///        gate Confirmed(role)            => OnlineGate.
///        gate Unreachable                => fall through.
///   3. floor                             => StudentReadOnly ("Connect to continue").
///
/// Never returns a role sourced from the loose column (Req 4.4, 6.4).
pub fn resolve_access(state: &AuthState, require_privileged: bool) -> AuthContext {
    // --- Layer 2: offline JWT verify (trusted) ---
    if let Ok(claims) = verify_cached_role(&state.store) {
        return AuthContext {
            role: claims.role,
            read_only: false,
            source: AuthSource::OfflineVerified,
        };
    }

    // --- Layer 1 fallback: online gate re-check (stricter: needs connection) ---
    // We pass the stored token to the gate so Supabase can re-decide. We do NOT
    // read the loose role; the gate's answer is authoritative, or it is Unreachable.
    if let Ok(Some(session)) = state.store.load_cached_session() {
        if let GateOutcome::Confirmed(role) = state.gate.recheck(&session.access_token) {
            // A privileged action with a confirmed privileged role is a full
            // grant; otherwise the UI is scoped to the (non-privileged) role and
            // privileged writes are read-only.
            let read_only = require_privileged && !role.is_privileged();
            return AuthContext {
                role,
                read_only,
                source: AuthSource::OnlineGate,
            };
        }
    }

    // --- Floor: offline + unverifiable => Student read-only ("Connect to continue") ---
    // NEVER returns the loose cached_session.role here (Req 6.4).
    AuthContext {
        role: Role::Student,
        read_only: true,
        source: AuthSource::StudentReadOnly,
    }
}

#[cfg(test)]
mod orchestrator_tests {
    use super::*;
    use crate::auth::session_store::CachedSession;

    /// A test gate with a scripted outcome, so resolver branches are driven
    /// without any network.
    struct ScriptGate(GateOutcome);
    impl OnlineGate for ScriptGate {
        fn recheck(&self, _access_token: &str) -> GateOutcome {
            self.0
        }
    }

    fn store_with_row(role: &str, token: &str, jwks: &str) -> SessionStore {
        let store = SessionStore::open_in_memory().unwrap();
        store
            .store_cached_session(&CachedSession {
                user_id: "u1".to_string(),
                email: "t@x.com".to_string(),
                role: role.to_string(),
                access_token: token.to_string(),
                jwks_cache: jwks.to_string(),
                cached_at: device_now(),
                token_exp: device_now() + 100_000,
            })
            .unwrap();
        store
    }

    #[test]
    fn verify_fail_gate_confirmed_yields_online_gate() {
        // Token/jwks that cannot verify offline (garbage), so Layer 2 fails and we
        // drop to the gate, which is scripted to confirm Teacher.
        let store = store_with_row("admin", "not.a.jwt", "{\"keys\":[]}");
        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Confirmed(Role::Teacher))));
        let ctx = resolve_access(&state, true);
        assert_eq!(ctx.source, AuthSource::OnlineGate);
        // The gate's role is used, NOT the loose "admin" column.
        assert_eq!(ctx.role, Role::Teacher);
        assert!(!ctx.read_only);
    }

    #[test]
    fn verify_fail_gate_unreachable_yields_student_read_only() {
        let store = store_with_row("admin", "not.a.jwt", "{\"keys\":[]}");
        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, true);
        assert_eq!(ctx.source, AuthSource::StudentReadOnly);
        assert_eq!(ctx.role, Role::Student);
        assert!(ctx.read_only, "offline floor is read-only (Req 6.3)");
    }

    #[test]
    fn no_session_offline_yields_student_read_only() {
        let store = SessionStore::open_in_memory().unwrap();
        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, false);
        assert_eq!(ctx.source, AuthSource::StudentReadOnly);
        assert_eq!(ctx.role, Role::Student);
        assert!(ctx.read_only);
    }

    #[test]
    fn gate_confirms_student_privileged_action_is_read_only() {
        let store = store_with_row("admin", "not.a.jwt", "{\"keys\":[]}");
        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Confirmed(Role::Student))));
        let ctx = resolve_access(&state, true);
        assert_eq!(ctx.source, AuthSource::OnlineGate);
        assert_eq!(ctx.role, Role::Student);
        assert!(ctx.read_only, "a Student cannot perform a privileged action");
    }
}

#[cfg(test)]
mod property_tests {
    //! Property-based tests for the design's correctness properties, grounded in
    //! the loose-role column being attacker-controlled.
    use super::*;
    use crate::auth::gate::{GateOutcome, OnlineGate};
    use crate::auth::session_store::{CachedSession, SessionStore};
    use proptest::prelude::*;

    struct ScriptGate(GateOutcome);
    impl OnlineGate for ScriptGate {
        fn recheck(&self, _t: &str) -> GateOutcome {
            self.0
        }
    }

    fn state_with_loose_role(
        loose_role: &str,
        gate: GateOutcome,
    ) -> AuthState {
        let store = SessionStore::open_in_memory().unwrap();
        // Store an UNVERIFIABLE token (garbage) alongside an arbitrary loose role,
        // so Layer 2 always fails and the loose column is the only "role" present
        // in SQLite. The resolver must never surface it.
        store
            .store_cached_session(&CachedSession {
                user_id: "u1".to_string(),
                email: "t@x.com".to_string(),
                role: loose_role.to_string(),
                access_token: "not.a.valid.jwt".to_string(),
                jwks_cache: "{\"keys\":[]}".to_string(),
                cached_at: device_now(),
                token_exp: device_now() + 100_000,
            })
            .unwrap();
        AuthState::new(store, Box::new(ScriptGate(gate)))
    }

    // Valid DB role values (the check constraint bounds the column to these).
    fn role_strategy() -> impl Strategy<Value = String> {
        prop_oneof![Just("student"), Just("teacher"), Just("admin")].prop_map(String::from)
    }

    proptest! {
        /// Property 1 / Property 4 — No trust without proof, Never fail open.
        /// For ANY loose role in the DB, when Layer 2 verify fails and the gate is
        /// unreachable, the resolved role is never derived from the loose column:
        /// it is Student read-only. There is no path from the loose column to a
        /// privileged grant without a signature verify or a live gate confirmation.
        #[test]
        fn p1_p4_loose_role_never_grants_access(loose in role_strategy()) {
            let state = state_with_loose_role(&loose, GateOutcome::Unreachable);
            let ctx = resolve_access(&state, true);
            prop_assert_eq!(ctx.source, AuthSource::StudentReadOnly);
            prop_assert_eq!(ctx.role, Role::Student);
            prop_assert!(ctx.read_only);
        }

        /// Property 2 — Fail toward more verification. On any verify failure, the
        /// result source is always OnlineGate (if the gate confirms) or
        /// StudentReadOnly — never a role sourced from the loose column.
        #[test]
        fn p2_verify_failure_falls_to_gate_or_floor(
            loose in role_strategy(),
            confirm in any::<bool>(),
        ) {
            let gate = if confirm {
                GateOutcome::Confirmed(Role::Teacher)
            } else {
                GateOutcome::Unreachable
            };
            let state = state_with_loose_role(&loose, gate);
            let ctx = resolve_access(&state, true);
            prop_assert!(matches!(
                ctx.source,
                AuthSource::OnlineGate | AuthSource::StudentReadOnly
            ));
            // Never OfflineVerified/OnlineVerified: Layer 2 cannot succeed on garbage.
            prop_assert_ne!(ctx.source, AuthSource::OfflineVerified);
            prop_assert_ne!(ctx.source, AuthSource::OnlineVerified);
        }

        /// Property 6 — Removable layer. With Layer 2 effectively disabled (the
        /// token never verifies), every privileged resolution offline (gate
        /// Unreachable) yields read-only Student — i.e. the online gate alone is a
        /// complete, safe enforcement.
        #[test]
        fn p6_layer2_removed_offline_is_student_read_only(loose in role_strategy()) {
            let state = state_with_loose_role(&loose, GateOutcome::Unreachable);
            let ctx = resolve_access(&state, true);
            prop_assert_eq!(ctx.role, Role::Student);
            prop_assert!(ctx.read_only);
        }
    }
}

#[cfg(test)]
mod e2e {
    //! End-to-end offline session-cache flow, mirroring the `lib.rs` e2e style:
    //! mint a real RSA-signed token + matching JWKS -> cache it (as a completed
    //! login would) -> resolve offline => OfflineVerified -> use an expired token
    //! => verify fails -> gate unreachable => StudentReadOnly + "Connect to
    //! continue". Fully offline, no webview, no network. Also proves the
    //! tampered-role-column attack is a no-op (Req 4.3).
    use super::*;
    use crate::auth::gate::{GateOutcome, OnlineGate};
    use crate::auth::session_store::{CachedSession, SessionStore};
    use base64::Engine;
    use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
    use rsa::pkcs1::EncodeRsaPrivateKey;
    use rsa::traits::PublicKeyParts;
    use rsa::RsaPrivateKey;
    use serde::Serialize;

    struct ScriptGate(GateOutcome);
    impl OnlineGate for ScriptGate {
        fn recheck(&self, _t: &str) -> GateOutcome {
            self.0
        }
    }

    #[derive(Serialize)]
    struct Claims {
        sub: String,
        email: String,
        role: String,
        exp: i64,
    }

    /// A freshly generated RSA keypair, the signed token, and the JWKS JSON that
    /// contains the matching public key. `kid` ties the token header to the key.
    struct Minted {
        token: String,
        jwks: String,
    }

    fn mint(role: &str, exp: i64) -> Minted {
        let mut rng = rand::thread_rng();
        let private = RsaPrivateKey::new(&mut rng, 2048).expect("generate RSA key");
        let public = private.to_public_key();

        // JWK public components, base64url (no pad), as a JWKS expects.
        let b64 = |b: &[u8]| base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b);
        let n = b64(&public.n().to_bytes_be());
        let e = b64(&public.e().to_bytes_be());
        let kid = "e2e-key";
        let jwks = format!(
            r#"{{"keys":[{{"kty":"RSA","use":"sig","kid":"{kid}","alg":"RS256","n":"{n}","e":"{e}"}}]}}"#
        );

        let der = private.to_pkcs1_der().expect("der");
        let enc_key = EncodingKey::from_rsa_der(der.as_bytes());
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(kid.to_string());
        let claims = Claims {
            sub: "u1".to_string(),
            email: "teacher@example.com".to_string(),
            role: role.to_string(),
            exp,
        };
        let token = encode(&header, &claims, &enc_key).expect("sign token");

        Minted { token, jwks }
    }

    fn cache(store: &SessionStore, loose_role: &str, token: &str, jwks: &str, exp: i64) {
        store
            .store_cached_session(&CachedSession {
                user_id: "u1".to_string(),
                email: "teacher@example.com".to_string(),
                role: loose_role.to_string(),
                access_token: token.to_string(),
                jwks_cache: jwks.to_string(),
                cached_at: device_now(),
                token_exp: exp,
            })
            .unwrap();
    }

    #[test]
    fn offline_valid_token_resolves_offline_verified() {
        let exp = device_now() + 10 * 24 * 3600; // generous (days), like Spec A
        let minted = mint("teacher", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "teacher", &minted.token, &minted.jwks, exp);

        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, true);
        assert_eq!(ctx.source, AuthSource::OfflineVerified);
        assert_eq!(ctx.role, Role::Teacher);
        assert!(!ctx.read_only);
    }

    #[test]
    fn tampered_loose_role_is_ignored_in_favor_of_token_claim() {
        // Req 4.3: DB column says admin, token claim says student => student wins.
        let exp = device_now() + 10 * 24 * 3600;
        let minted = mint("student", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "admin", &minted.token, &minted.jwks, exp);

        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, false);
        assert_eq!(ctx.source, AuthSource::OfflineVerified);
        assert_eq!(ctx.role, Role::Student, "the loose 'admin' column must be ignored");
    }

    #[test]
    fn expired_token_offline_drops_to_student_read_only() {
        // Token already expired beyond skew; verify fails -> gate unreachable ->
        // StudentReadOnly + "Connect to continue".
        let exp = device_now() - (CLOCK_SKEW_TOLERANCE_SECS + 3600);
        let minted = mint("teacher", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "teacher", &minted.token, &minted.jwks, exp);

        // Confirm the direct verify sees it as expired.
        let err = verify_cached_role(&store).unwrap_err();
        assert!(matches!(err, AuthError::TokenExpired(_)));

        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, true);
        assert_eq!(ctx.source, AuthSource::StudentReadOnly);
        assert_eq!(ctx.role, Role::Student);
        assert!(ctx.read_only);
    }

    #[test]
    fn expired_token_but_gate_online_resolves_online_gate() {
        let exp = device_now() - (CLOCK_SKEW_TOLERANCE_SECS + 3600);
        let minted = mint("teacher", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "teacher", &minted.token, &minted.jwks, exp);

        let state =
            AuthState::new(store, Box::new(ScriptGate(GateOutcome::Confirmed(Role::Teacher))));
        let ctx = resolve_access(&state, true);
        assert_eq!(ctx.source, AuthSource::OnlineGate);
        assert_eq!(ctx.role, Role::Teacher);
    }
}
