// auth::verify — Layer 2, the TRUSTED layer (SPEC B Req 3). Offline JWT
// verification: given the stored token and cached JWKS, verify the signature and
// `exp`, then return the role claim read ONLY from inside the verified token.
//
// This layer is REMOVABLE: delete it and the online gate (Layer 1) still stands.
// It is also the only place a `role` becomes trusted offline. It performs NO
// SQLite reads and has NO side effects — it is a pure function of (token, jwks).
//
// Clock-skew caution: offline, the device clock is the only `exp` truth and may
// drift. We allow a small `CLOCK_SKEW_TOLERANCE_SECS` grace, then treat the token
// as expired (fail CLOSED). Spec A sets a generous (days) token lifetime so this
// is a margin, not a crutch.

use crate::auth::{AuthError, Role, VerifiedClaims, CLOCK_SKEW_TOLERANCE_SECS};
use jsonwebtoken::jwk::{AlgorithmParameters, JwkSet};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

/// The claims we expect inside the Supabase access token. We decode these only
/// AFTER the signature verifies.
///
/// IMPORTANT (ADR 0004): Supabase's own top-level `role` claim is the POSTGRES
/// role (`authenticated`/`anon`), not the Syndes app role. The app role and the
/// approval flag live in `app_metadata`, which only an Administrator (service
/// role) can write — never the end user. We therefore read `role`/`approved`
/// from `app_metadata` and ignore the top-level `role` entirely.
#[derive(Debug, Deserialize)]
struct RawClaims {
    sub: String,
    email: String,
    exp: i64,
    #[serde(default)]
    app_metadata: AppMetadata,
}

/// Admin-controlled custom claims Supabase nests under `app_metadata`. Both
/// fields are optional on the wire so a token minted before the custom claims
/// were configured fails CLOSED: a missing `role` is a `MalformedToken`, and a
/// missing `approved` means not approved.
#[derive(Debug, Default, Deserialize)]
struct AppMetadata {
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    approved: bool,
}

/// Verify a token against the cached JWKS and return the in-token claims — the
/// ONLY path by which an offline role becomes trusted.
///
/// Failure causes are evaluated in a FIXED order so overlapping failures yield a
/// single deterministic error (Req 3.6):
///   MissingJwks -> JwksParseError -> MalformedToken -> SignatureInvalid -> TokenExpired
/// (`NoCachedSession` is detected one level up, by the caller that loads the row.)
///
/// Pure: no SQLite, no network, never panics (Req 3 postconditions).
pub fn verify_jwt(access_token: &str, jwks_cache: &str) -> Result<VerifiedClaims, AuthError> {
    // 1. JWKS presence/parse (MissingJwks before JwksParseError).
    if jwks_cache.trim().is_empty() {
        return Err(AuthError::MissingJwks("jwks_cache is empty".to_string()));
    }
    let jwks: JwkSet = serde_json::from_str(jwks_cache)
        .map_err(|e| AuthError::JwksParseError(format!("jwks is not a valid JWK set: {e}")))?;
    if jwks.keys.is_empty() {
        // A syntactically valid but empty set has no key to verify against; treat
        // it as missing rather than a parse failure.
        return Err(AuthError::MissingJwks("jwks set contains no keys".to_string()));
    }

    // 2. Decode the token header (MalformedToken on failure) and select the key.
    let header = decode_header(access_token)
        .map_err(|e| AuthError::MalformedToken(format!("token header did not decode: {e}")))?;

    let jwk = select_key(&jwks, header.kid.as_deref()).ok_or_else(|| {
        // No key matched the token's `kid`. There is nothing to verify the
        // signature against, so the signature cannot be trusted => SignatureInvalid.
        AuthError::SignatureInvalid("no JWKS key matches the token key id (kid)".to_string())
    })?;

    let decoding_key = match &jwk.algorithm {
        AlgorithmParameters::RSA(rsa) => DecodingKey::from_rsa_components(&rsa.n, &rsa.e)
            .map_err(|e| AuthError::JwksParseError(format!("RSA key components invalid: {e}")))?,
        AlgorithmParameters::EllipticCurve(ec) => {
            DecodingKey::from_ec_components(&ec.x, &ec.y)
                .map_err(|e| AuthError::JwksParseError(format!("EC key components invalid: {e}")))?
        }
        other => {
            return Err(AuthError::JwksParseError(format!(
                "unsupported JWKS key type: {other:?}"
            )))
        }
    };

    // 3. Signature verification. We disable jsonwebtoken's built-in exp check and
    // do our OWN `exp` test afterward so we control the skew tolerance and can map
    // "expired" to `TokenExpired` while "bad signature" maps to `SignatureInvalid`
    // — two distinct causes in the fixed order (Req 3.11 before 3.12).
    let alg = jwk
        .common
        .key_algorithm
        .and_then(map_key_algorithm)
        .unwrap_or(Algorithm::RS256);
    let mut validation = Validation::new(alg);
    validation.validate_exp = false;
    validation.validate_aud = false;

    let data = decode::<RawClaims>(access_token, &decoding_key, &validation).map_err(|e| {
        use jsonwebtoken::errors::ErrorKind;
        match e.kind() {
            // A structurally bad token slipped past the header decode.
            ErrorKind::InvalidToken | ErrorKind::Base64(_) | ErrorKind::Json(_) => {
                AuthError::MalformedToken(format!("token did not decode: {e}"))
            }
            // Everything else at this stage is a signature/verification failure.
            _ => AuthError::SignatureInvalid(format!("signature did not verify: {e}")),
        }
    })?;

    let claims = data.claims;

    // 4. Our own expiry check against the device clock, with skew tolerance.
    let now = crate::auth::device_now();
    if claims.exp < now - CLOCK_SKEW_TOLERANCE_SECS {
        return Err(AuthError::TokenExpired(
            "token exp is in the past beyond the clock-skew tolerance".to_string(),
        ));
    }

    // 5. Parse the role claim LAST, from the VERIFIED token's app_metadata only.
    //    A token with no app_metadata.role is malformed for our purposes — it
    //    cannot be mapped to a Syndes role, so it must not grant any access.
    let role_str = claims.app_metadata.role.as_deref().ok_or_else(|| {
        AuthError::MalformedToken("token app_metadata is missing the role claim".to_string())
    })?;
    let role = Role::from_claim(role_str)?;

    Ok(VerifiedClaims {
        sub: claims.sub,
        email: claims.email,
        role,
        approved: claims.app_metadata.approved,
        exp: claims.exp,
    })
}

/// Select the verifying key. When the token carries a `kid` and the set has more
/// than one key, match by `kid` (Req 3.2). With a single key and no `kid`, use
/// that key. Returns `None` when nothing matches.
fn select_key<'a>(
    jwks: &'a JwkSet,
    kid: Option<&str>,
) -> Option<&'a jsonwebtoken::jwk::Jwk> {
    match kid {
        Some(kid) => {
            if let Some(k) = jwks.find(kid) {
                return Some(k);
            }
            // A `kid` was given but did not match. If there is exactly one key,
            // fall back to it; otherwise there is no unambiguous key.
            if jwks.keys.len() == 1 {
                jwks.keys.first()
            } else {
                None
            }
        }
        // No `kid`: only unambiguous when there is exactly one key.
        None => {
            if jwks.keys.len() == 1 {
                jwks.keys.first()
            } else {
                None
            }
        }
    }
}

/// Map a JWKS `KeyAlgorithm` to the `jsonwebtoken` `Algorithm` used for
/// verification. Covers the RSA + EC families Supabase uses.
fn map_key_algorithm(k: jsonwebtoken::jwk::KeyAlgorithm) -> Option<Algorithm> {
    use jsonwebtoken::jwk::KeyAlgorithm as K;
    Some(match k {
        K::RS256 => Algorithm::RS256,
        K::RS384 => Algorithm::RS384,
        K::RS512 => Algorithm::RS512,
        K::ES256 => Algorithm::ES256,
        K::ES384 => Algorithm::ES384,
        K::PS256 => Algorithm::PS256,
        K::PS384 => Algorithm::PS384,
        K::PS512 => Algorithm::PS512,
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_jwks_is_missing_jwks() {
        let err = verify_jwt("a.b.c", "").unwrap_err();
        assert!(matches!(err, AuthError::MissingJwks(_)));
        let err = verify_jwt("a.b.c", "   ").unwrap_err();
        assert!(matches!(err, AuthError::MissingJwks(_)));
    }

    #[test]
    fn unparseable_jwks_is_jwks_parse_error() {
        let err = verify_jwt("a.b.c", "{not json").unwrap_err();
        assert!(matches!(err, AuthError::JwksParseError(_)));
    }

    #[test]
    fn valid_json_but_no_keys_is_missing_jwks() {
        let err = verify_jwt("a.b.c", r#"{"keys":[]}"#).unwrap_err();
        assert!(matches!(err, AuthError::MissingJwks(_)));
    }

    #[test]
    fn malformed_token_is_malformed_token() {
        // A JWKS with one RSA key so we get past the JWKS stage to header decode.
        let jwks = sample_rsa_jwks();
        let err = verify_jwt("this-is-not-a-jwt", &jwks).unwrap_err();
        assert!(matches!(err, AuthError::MalformedToken(_)));
    }

    /// A minimal single-key RSA JWK set (public components only). Enough to drive
    /// the JWKS-parse and key-selection paths in unit tests; signature-positive
    /// cases are covered by the integration test which mints a matching token.
    fn sample_rsa_jwks() -> String {
        r#"{"keys":[{
            "kty":"RSA",
            "use":"sig",
            "kid":"test-key",
            "alg":"RS256",
            "n":"0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
            "e":"AQAB"
        }]}"#
        .to_string()
    }

    #[test]
    fn single_key_selected_without_kid() {
        let jwks: JwkSet = serde_json::from_str(&sample_rsa_jwks()).unwrap();
        assert!(select_key(&jwks, None).is_some());
        assert!(select_key(&jwks, Some("test-key")).is_some());
        // Unmatched kid, single key => fall back to the one key.
        assert!(select_key(&jwks, Some("other")).is_some());
    }
}
