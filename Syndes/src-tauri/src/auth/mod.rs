// Supabase Auth supplies a signed Account identity. The current Account RPC
// supplies approval and Teacher permission. A local receipt keeps an approved
// Learner studying offline after token expiry until explicit sign-out; it never
// authorizes Teacher operations. The loose cached role column is never trusted.

use serde::Serialize;

pub mod gate;
pub mod project;
pub mod seam;
pub mod session_store;
pub mod verify;

/// Syndes roles returned by current Account authority. A verified token's
/// optional metadata role is used only for offline display.
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
        match s.to_ascii_lowercase().as_str() {
            "student" => Ok(Role::Student),
            "teacher" => Ok(Role::Teacher),
            "admin" | "administrator" => Ok(Role::Admin),
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

/// Identity claims read after project-pinned signature, issuer, and audience
/// verification. An expired signature is accepted only for local study, after
/// this Account has previously received a live approval receipt.
///
/// Token metadata never grants Teacher access or current approval. The live
/// Account RPC decides those; the token role is only an offline display value.
#[derive(Debug, Clone)]
pub struct VerifiedClaims {
    pub sub: String,
    pub email: String,
    pub role: Role,
    pub exp: i64,
}

/// Where a resolved access decision came from. The UI permits Teacher pages
/// only for a fresh `OnlineGate` decision. camelCase at the IPC boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AuthSource {
    /// Token verified against freshly fetched keys at login time.
    OnlineVerified,
    /// Token verified offline for local learning.
    OfflineVerified,
    /// The live Account RPC confirmed current access.
    OnlineGate,
    /// No usable local grant.
    StudentReadOnly,
}

/// What a resolved access decision looks like to the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthContext {
    pub account_id: Option<String>,
    /// Effective role to scope the UI.
    pub role: Role,
    /// Whether this Account is approved for learning access (ADR 0004/0007).
    /// A pending (unapproved) Account can sign in but cannot study any Module,
    /// local or published. False in the Student-read-only floor.
    pub approved: bool,
    pub active: bool,
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
/// barely-expired token from flapping for online privileged operations. Local
/// study uses a previously confirmed Account receipt after JWT expiry.
pub(crate) const CLOCK_SKEW_TOLERANCE_SECS: i64 = 60;

// Resolution verifies the signed Account identity before checking current
// authority. Teacher operations require the online gate; learning may use the
// last live approval receipt while offline.

use crate::auth::gate::{GateOutcome, OnlineGate};
use crate::auth::session_store::SessionStore;

/// Tauri-managed auth state: the session store (Layer 1 data + Layer 2 input) and
/// the online gate (Layer 1 enforcement). Held behind Tauri's `State`.
pub struct AuthState {
    pub store: SessionStore,
    pub gate: Box<dyn OnlineGate + Send + Sync>,
    pub project: Option<project::ProjectConfig>,
}

impl AuthState {
    pub fn new(store: SessionStore, gate: Box<dyn OnlineGate + Send + Sync>) -> AuthState {
        #[cfg(test)]
        let project = Some(project::ProjectConfig::test());
        #[cfg(not(test))]
        let project = project::ProjectConfig::configured().ok();
        AuthState {
            store,
            gate,
            project,
        }
    }
}

/// The trusted check (SPEC B Req 3 shape): load the raw row, then verify. Trusts
/// ONLY the in-token role returned by `verify_jwt`, never `session.role`. A
/// missing row is `NoCachedSession` — the first cause in the fixed order.
#[cfg(test)]
pub(crate) fn verify_cached_role(
    store: &SessionStore,
    issuer: &str,
) -> Result<VerifiedClaims, AuthError> {
    let session = store.load_cached_session()?.ok_or_else(|| {
        AuthError::NoCachedSession("no cached session on this device".to_string())
    })?;
    // The loose `session.role` is deliberately IGNORED here; the role is read
    // only from the verified token inside verify_jwt.
    verify::verify_jwt(&session.access_token, &session.jwks_cache, issuer, true)
}

/// Resolve Account access at the command boundary. A signed project identity is
/// required first. Teacher operations require a fresh RPC; learning may use the
/// last live approval receipt offline, including after JWT expiry until sign-out.
pub fn resolve_access(state: &AuthState, require_privileged: bool) -> AuthContext {
    resolve_access_with_refresh(state, require_privileged, true)
}

/// Learner commands can use the last verified receipt immediately while offline.
/// The UI calls `auth_resolve_role` on reconnect to refresh Account status.
pub fn resolve_study_access(state: &AuthState) -> AuthContext {
    resolve_access_with_refresh(state, false, false)
}

fn resolve_access_with_refresh(
    state: &AuthState,
    require_privileged: bool,
    refresh_online: bool,
) -> AuthContext {
    let Some(project) = state.project.as_ref() else {
        return STUDENT_FLOOR_CTX;
    };
    let Ok(Some(session)) = state.store.load_cached_session() else {
        return STUDENT_FLOOR_CTX;
    };
    // Signature and project identity remain mandatory even when the access
    // token has expired. Expiry only controls online calls, not local study.
    let Ok(claims) = verify::verify_jwt(
        &session.access_token,
        &session.jwks_cache,
        &project.issuer,
        true,
    ) else {
        return STUDENT_FLOOR_CTX;
    };
    if session.user_id != claims.sub {
        return STUDENT_FLOOR_CTX;
    }
    let token_current = claims.exp >= device_now() - CLOCK_SKEW_TOLERANCE_SECS;
    if require_privileged && !token_current {
        return STUDENT_FLOOR_CTX;
    }

    // The live RPC reads current Account state and wins over stale token claims.
    // It is attempted on every resolution, so revocation takes effect on the
    // first successful connection. A failed RPC cannot grant Teacher access.
    if token_current && refresh_online {
        if let GateOutcome::Confirmed {
            role,
            approved,
            active,
        } = state.gate.recheck(&session.access_token, &claims.sub)
        {
            let _ = state.store.store_account_receipt(
                &claims.sub,
                session_store::AccountReceipt { approved, active },
            );
            return AuthContext {
                account_id: Some(claims.sub),
                role,
                approved,
                active,
                read_only: !active || (require_privileged && !role.is_privileged()),
                source: AuthSource::OnlineGate,
            };
        }
    }

    if require_privileged {
        return STUDENT_FLOOR_CTX;
    }
    let Ok(Some(receipt)) = state.store.load_account_receipt(&claims.sub) else {
        return STUDENT_FLOOR_CTX;
    };
    AuthContext {
        account_id: Some(claims.sub),
        role: claims.role,
        approved: receipt.approved,
        active: receipt.active,
        read_only: !receipt.active,
        source: AuthSource::OfflineVerified,
    }
}

/// The Student read-only floor as an AuthContext — offline + unverifiable, never
/// approved, never privileged. Centralised so both the privileged-gate-miss path
/// and the learner-fallback path return exactly the same floor.
const STUDENT_FLOOR_CTX: AuthContext = AuthContext {
    account_id: None,
    role: Role::Student,
    approved: false,
    active: false,
    read_only: true,
    source: AuthSource::StudentReadOnly,
};

#[cfg(test)]
pub(crate) mod e2e {
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
        fn recheck(&self, _t: &str, _account_id: &str) -> GateOutcome {
            self.0
        }
    }

    #[derive(Serialize)]
    struct AppMeta {
        role: String,
        approved: bool,
    }

    #[derive(Serialize)]
    struct Claims {
        sub: String,
        email: String,
        iss: String,
        aud: String,
        app_metadata: AppMeta,
        exp: i64,
    }

    /// A freshly generated RSA keypair, the signed token, and the JWKS JSON that
    /// contains the matching public key. `kid` ties the token header to the key.
    pub(crate) struct Minted {
        pub(crate) token: String,
        pub(crate) jwks: String,
    }

    pub(crate) fn mint(role: &str, exp: i64) -> Minted {
        mint_with_approval(role, true, exp)
    }

    fn mint_with_approval(role: &str, approved: bool, exp: i64) -> Minted {
        mint_with_identity(
            role,
            approved,
            exp,
            &project::ProjectConfig::test().issuer,
            "authenticated",
        )
    }

    fn mint_with_identity(
        role: &str,
        approved: bool,
        exp: i64,
        issuer: &str,
        audience: &str,
    ) -> Minted {
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
            iss: issuer.to_string(),
            aud: audience.to_string(),
            app_metadata: AppMeta {
                role: role.to_string(),
                approved,
            },
            exp,
        };
        let token = encode(&header, &claims, &enc_key).expect("sign token");

        Minted { token, jwks }
    }

    pub(crate) fn cache(store: &SessionStore, loose_role: &str, token: &str, jwks: &str, exp: i64) {
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
        store
            .store_account_receipt(
                "u1",
                session_store::AccountReceipt {
                    approved: true,
                    active: true,
                },
            )
            .unwrap();
    }

    #[test]
    fn offline_valid_token_resolves_offline_verified_for_learner() {
        let exp = device_now() + 10 * 24 * 3600; // generous (days), like Spec A
        let minted = mint("teacher", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "teacher", &minted.token, &minted.jwks, exp);

        // NON-privileged (learner) access: offline verify is first-class.
        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, false);
        assert_eq!(ctx.source, AuthSource::OfflineVerified);
        assert_eq!(ctx.role, Role::Teacher);
        assert!(ctx.approved, "mint() defaults to approved=true");
        assert!(!ctx.read_only);
    }

    #[test]
    fn offline_valid_token_privileged_action_is_refused_without_fresh_online() {
        // ADR 0004: a privileged action requires a FRESH online check. A perfectly
        // valid, offline-verifiable cached token is NOT a fresh check, so when the
        // gate is unreachable the privileged resolution must drop to the floor —
        // never OfflineVerified.
        let exp = device_now() + 10 * 24 * 3600;
        let minted = mint("teacher", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "teacher", &minted.token, &minted.jwks, exp);

        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, true);
        assert_eq!(
            ctx.source,
            AuthSource::StudentReadOnly,
            "a privileged action offline must not ride an offline-verified token"
        );
        assert_eq!(ctx.role, Role::Student);
        assert!(ctx.read_only);
    }

    #[test]
    fn offline_unapproved_token_verifies_but_is_not_approved() {
        // A validly-signed token whose app_metadata.approved is false: the role is
        // trusted (OfflineVerified) but the Account is NOT approved, so learner /
        // teacher gates must refuse it (ADR 0004 pending Account).
        let exp = device_now() + 10 * 24 * 3600;
        let minted = mint_with_approval("student", false, exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "student", &minted.token, &minted.jwks, exp);
        store
            .store_account_receipt(
                "u1",
                session_store::AccountReceipt {
                    approved: false,
                    active: true,
                },
            )
            .unwrap();

        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, false);
        assert_eq!(ctx.source, AuthSource::OfflineVerified);
        assert_eq!(ctx.role, Role::Student);
        assert!(
            !ctx.approved,
            "a pending Account must resolve as not approved"
        );
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
        assert_eq!(
            ctx.role,
            Role::Student,
            "the loose 'admin' column must be ignored"
        );
    }

    #[test]
    fn expired_token_offline_keeps_approved_learning_until_sign_out() {
        let exp = device_now() - (CLOCK_SKEW_TOLERANCE_SECS + 3600);
        let minted = mint("teacher", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "teacher", &minted.token, &minted.jwks, exp);

        // Confirm the direct verify sees it as expired.
        let claims = verify_cached_role(&store, &project::ProjectConfig::test().issuer).unwrap();
        assert_eq!(claims.sub, "u1");

        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        let ctx = resolve_access(&state, false);
        assert_eq!(ctx.source, AuthSource::OfflineVerified);
        assert!(ctx.approved);
        assert!(ctx.active);
        assert_eq!(ctx.account_id.as_deref(), Some("u1"));
    }

    #[test]
    fn live_gate_grants_teacher_without_learning_approval() {
        let exp = device_now() + 3600;
        let minted = mint("teacher", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "teacher", &minted.token, &minted.jwks, exp);

        let state = AuthState::new(
            store,
            Box::new(ScriptGate(GateOutcome::Confirmed {
                role: Role::Teacher,
                approved: false,
                active: true,
            })),
        );
        let ctx = resolve_access(&state, true);
        assert_eq!(ctx.source, AuthSource::OnlineGate);
        assert_eq!(ctx.role, Role::Teacher);
        assert!(!ctx.approved);
        assert!(ctx.active);
    }

    #[test]
    fn foreign_project_and_wrong_audience_cannot_open_local_modules() {
        for minted in [
            mint_with_identity(
                "student",
                true,
                device_now() + 3600,
                "https://other.supabase.co/auth/v1",
                "authenticated",
            ),
            mint_with_identity(
                "student",
                true,
                device_now() + 3600,
                &project::ProjectConfig::test().issuer,
                "service_role",
            ),
        ] {
            let store = SessionStore::open_in_memory().unwrap();
            cache(
                &store,
                "student",
                &minted.token,
                &minted.jwks,
                device_now() + 3600,
            );
            let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
            let ctx = resolve_access(&state, false);
            assert_eq!(ctx.source, AuthSource::StudentReadOnly);
            assert!(!ctx.approved);
        }
    }

    #[test]
    fn revocation_hides_learning_on_next_connection_and_stays_hidden_offline() {
        let exp = device_now() + 3600;
        let minted = mint("student", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "student", &minted.token, &minted.jwks, exp);
        let state = AuthState::new(
            store,
            Box::new(ScriptGate(GateOutcome::Confirmed {
                role: Role::Student,
                approved: false,
                active: false,
            })),
        );
        let ctx = resolve_access(&state, false);
        assert!(!ctx.active);
        assert!(!ctx.approved);
        assert_eq!(
            state
                .store
                .load_account_receipt("u1")
                .unwrap()
                .unwrap()
                .active,
            false
        );
    }

    #[test]
    fn sign_out_hides_account_while_retaining_offline_receipt_for_next_sign_in() {
        let exp = device_now() + 3600;
        let minted = mint("student", exp);
        let store = SessionStore::open_in_memory().unwrap();
        cache(&store, "student", &minted.token, &minted.jwks, exp);
        let state = AuthState::new(store, Box::new(ScriptGate(GateOutcome::Unreachable)));
        state.store.clear_cached_session().unwrap();
        assert_eq!(
            resolve_access(&state, false).source,
            AuthSource::StudentReadOnly
        );
        assert!(
            state
                .store
                .load_account_receipt("u1")
                .unwrap()
                .unwrap()
                .approved
        );
    }

    #[test]
    fn unverified_cached_token_cannot_use_a_live_gate_result() {
        let store = SessionStore::open_in_memory().unwrap();
        cache(
            &store,
            "admin",
            "not.a.valid.jwt",
            r#"{"keys":[]}"#,
            device_now() + 3600,
        );
        let state = AuthState::new(
            store,
            Box::new(ScriptGate(GateOutcome::Confirmed {
                role: Role::Admin,
                approved: true,
                active: true,
            })),
        );
        assert_eq!(
            resolve_access(&state, true).source,
            AuthSource::StudentReadOnly
        );
        assert_eq!(
            resolve_access(&state, false).source,
            AuthSource::StudentReadOnly
        );
    }
}
