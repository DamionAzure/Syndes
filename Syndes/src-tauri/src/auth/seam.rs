// auth::seam — the input seam with Spec A (SPEC B Req 2, 7). The ONLINE login
// write: fetch + cache JWKS while online, verify the token against the freshly
// fetched keys, and ONLY on a successful verify persist the `cached_session`
// row. Write-after-verify is the invariant here: nothing touches SQLite until the
// token has proven itself (Req 2.2, 2.5).
//
// This module never DECIDES a role — it caches the one Supabase already decided,
// after proving the signature. On any failure it writes nothing and returns a
// typed error carrying no role.

use crate::auth::gate::{GateOutcome, OnlineGate};
use crate::auth::project::ProjectConfig;
use crate::auth::session_store::AccountReceipt;
use crate::auth::session_store::{CachedSession, SessionStore};
use crate::auth::{verify, AuthContext, AuthError, AuthSource};
use std::time::Duration;

/// Bounded time for the JWKS fetch. A slow/unreachable network becomes a
/// `NetworkError` rather than hanging the login.
const JWKS_FETCH_TIMEOUT: Duration = Duration::from_secs(10);

/// Fetch JWKS, verify the token, and persist the session — the whole online
/// login write (Req 2). Returns an `AuthContext { source: OnlineVerified }` on
/// success. On ANY failure, writes no row, leaves any existing row unchanged, and
/// returns a typed `AuthError` with no role.
///
/// Order is strict (Req 2.1 -> 2.2 -> 2.3): fetch (online) BEFORE verify, verify
/// BEFORE any write.
pub fn store_session_online(
    store: &SessionStore,
    access_token: &str,
    project: &ProjectConfig,
    gate: &dyn OnlineGate,
) -> Result<AuthContext, AuthError> {
    // Req 7.1/7.2: the token must carry a well-formed claim contract. We check
    // the shape up front so a structurally wrong token is rejected as a contract
    // error before we spend a network round trip. (The signature is still what
    // ultimately grants trust, verified below.)
    validate_token_contract(access_token)?;

    // Req 2.1: fetch JWKS while online, before any verification or write.
    let jwks_json = fetch_jwks(&project.jwks_url)?;

    // Req 2.2: verify signature + exp against the FRESHLY fetched keys, before
    // writing anything. verify_jwt returns the trusted in-token claims.
    let claims = verify::verify_jwt(access_token, &jwks_json, &project.issuer, false)?;
    let (role, approved, active) = match gate.recheck(access_token, &claims.sub) {
        GateOutcome::Confirmed {
            role,
            approved,
            active,
        } => (role, approved, active),
        GateOutcome::Unreachable => {
            return Err(AuthError::NetworkError(
                "current Account access could not be confirmed".into(),
            ))
        }
    };

    // Req 2.3: only now — after a successful verify — persist exactly one row.
    let session = CachedSession {
        user_id: claims.sub.clone(),
        email: claims.email.clone(),
        // Cache the role STRING for display only; the proof (token) travels with
        // it and is what any later read re-verifies.
        role: role.as_str().to_string(),
        access_token: access_token.to_string(),
        jwks_cache: jwks_json,
        cached_at: crate::auth::device_now(),
        token_exp: claims.exp,
    };
    store.store_cached_session(&session)?;
    store.store_account_receipt(&claims.sub, AccountReceipt { approved, active })?;

    // Req 2.4: return the in-token role with OnlineVerified provenance.
    Ok(AuthContext {
        account_id: Some(claims.sub),
        role,
        approved,
        active,
        read_only: !active,
        source: AuthSource::OnlineVerified,
    })
}

/// Validate the token's claim contract (Req 7.1, 7.2) WITHOUT trusting it: decode
/// the unverified payload only to confirm `sub`, `email`, and `exp` are present
/// and an optional application role is well-formed. A token missing a required
/// claim, or carrying an out-of-range role, is a
/// `MalformedToken`. This is a shape gate, not a trust decision — the signature
/// verify is still what grants access.
fn validate_token_contract(access_token: &str) -> Result<(), AuthError> {
    use base64::Engine;

    let payload_b64 = access_token.split('.').nth(1).ok_or_else(|| {
        AuthError::MalformedToken("token is not in header.payload.sig form".to_string())
    })?;

    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|e| AuthError::MalformedToken(format!("token payload is not base64url: {e}")))?;

    let value: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|e| AuthError::MalformedToken(format!("token payload is not JSON: {e}")))?;

    for claim in ["sub", "email", "exp"] {
        if value.get(claim).is_none() {
            return Err(AuthError::MalformedToken(format!(
                "token is missing required claim: {claim}"
            )));
        }
    }

    if value.get("exp").and_then(|e| e.as_i64()).is_none() {
        return Err(AuthError::MalformedToken(
            "exp claim is not an integer".to_string(),
        ));
    }

    // A newly registered Pending Account has no custom role claim. Current
    // authority comes from the live Account RPC; reject only malformed claims.
    if let Some(role) = value
        .get("app_metadata")
        .and_then(|m| m.get("role"))
        .and_then(|r| r.as_str())
    {
        crate::auth::Role::from_claim(role)?;
    }

    Ok(())
}

/// Fetch the JWKS from the Supabase endpoint over HTTPS using the existing
/// blocking `reqwest` client. On any network/HTTP failure return a `NetworkError`
/// (Req 2.6, 7.5) — the caller then writes nothing and keeps any prior JWKS.
fn fetch_jwks(jwks_url: &str) -> Result<String, AuthError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(JWKS_FETCH_TIMEOUT)
        .build()
        .map_err(|e| AuthError::NetworkError(format!("could not build http client: {e}")))?;

    let resp = client
        .get(jwks_url)
        .send()
        .map_err(|e| AuthError::NetworkError(format!("jwks fetch failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(AuthError::NetworkError(format!(
            "jwks fetch returned status {}",
            resp.status()
        )));
    }
    resp.text()
        .map_err(|e| AuthError::NetworkError(format!("jwks response body unreadable: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    fn make_token(payload: &serde_json::Value) -> String {
        let b64 = |b: &[u8]| base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b);
        let header = b64(br#"{"alg":"RS256","typ":"JWT"}"#);
        let body = b64(payload.to_string().as_bytes());
        format!("{header}.{body}.signature")
    }

    #[test]
    fn accepts_well_formed_claim_contract() {
        let tok = make_token(&serde_json::json!({
            "sub": "u1", "email": "t@x.com", "exp": 1_900_000_000i64,
            "app_metadata": { "role": "teacher", "approved": true }
        }));
        assert!(validate_token_contract(&tok).is_ok());
    }

    #[test]
    fn pending_account_can_sign_in_without_app_metadata_role() {
        let tok = make_token(&serde_json::json!({
            "sub": "u1", "email": "t@x.com", "exp": 1_900_000_000i64
        }));
        assert!(validate_token_contract(&tok).is_ok());
    }

    #[test]
    fn postgres_role_does_not_grant_application_role() {
        // The top-level Supabase `role` (Postgres role) must NOT satisfy the
        // contract: only app_metadata.role counts.
        let tok = make_token(&serde_json::json!({
            "sub": "u1", "email": "t@x.com", "role": "authenticated", "exp": 1_900_000_000i64
        }));
        assert!(validate_token_contract(&tok).is_ok());
    }

    #[test]
    fn rejects_out_of_range_role() {
        let tok = make_token(&serde_json::json!({
            "sub": "u1", "email": "t@x.com", "exp": 1_900_000_000i64,
            "app_metadata": { "role": "root" }
        }));
        let err = validate_token_contract(&tok).unwrap_err();
        assert!(matches!(err, AuthError::MalformedToken(_)));
    }

    #[test]
    fn rejects_non_jwt_shape() {
        let err = validate_token_contract("not-a-jwt").unwrap_err();
        assert!(matches!(err, AuthError::MalformedToken(_)));
    }
}
