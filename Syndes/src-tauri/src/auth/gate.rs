// auth::gate — Layer 1, the FLOOR (SPEC B Req 5). Zero cryptography.
//
// This is the demo-safe enforcement that ships FIRST and stands ALONE: a
// privileged action requires being online and re-asking Supabase for the role
// decision; offline, callers are Student-scoped read-only. Deleting Layer 2
// (`verify`) leaves this layer as the sole, still-secure enforcement.
//
// The gate NEVER trusts the cached role column. It only reports what a live
// Supabase re-check said, or that it could not reach Supabase. Anything other
// than a confirmed, successful re-check is `Unreachable`, which makes the caller
// fall to Student read-only — fail CLOSED (Req 5.4), never open.

use crate::auth::Role;
use std::time::Duration;

/// Bounded time for a gate re-check. Short enough that offline callers drop to
/// read-only quickly rather than hanging. A timeout is treated as `Unreachable`.
const GATE_TIMEOUT: Duration = Duration::from_secs(5);

/// The result of an online re-check (Req 5.2, 5.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GateOutcome {
    /// Online: Supabase re-confirmed the role for a privileged action.
    Confirmed(Role),
    /// Could not reach Supabase, timed out, or the re-check did not confirm —
    /// the caller must drop to Student read-only. Fail closed.
    Unreachable,
}

/// Layer 1 online re-check. Requires a live connection; offline / timeout /
/// non-success all map to `Unreachable` (Req 5.3, 5.4). No cryptographic
/// verification happens here — this layer is deliberately crypto-free so it
/// still works if Layer 2 is removed (Req 5.1).
pub trait OnlineGate {
    fn recheck(&self, access_token: &str) -> GateOutcome;
}

/// The real gate: re-asks Supabase over HTTPS using the existing blocking
/// `reqwest` client (same stack as the Groq path — no tokio pulled into the
/// command boundary). The re-check endpoint is injected because its exact shape
/// is Spec A's contract; this crate only consumes the yes/no + role answer.
pub struct SupabaseGate {
    /// The Supabase "who am I / re-confirm role" endpoint (Spec A seam).
    recheck_url: String,
}

impl SupabaseGate {
    pub fn new(recheck_url: impl Into<String>) -> SupabaseGate {
        SupabaseGate {
            recheck_url: recheck_url.into(),
        }
    }
}

impl OnlineGate for SupabaseGate {
    fn recheck(&self, access_token: &str) -> GateOutcome {
        let client = match reqwest::blocking::Client::builder()
            .timeout(GATE_TIMEOUT)
            .build()
        {
            Ok(c) => c,
            // If we cannot even build a client, we are certainly not confirming
            // a privileged action. Fail closed.
            Err(_) => return GateOutcome::Unreachable,
        };

        let resp = client
            .get(&self.recheck_url)
            .bearer_auth(access_token)
            .send();

        let resp = match resp {
            Ok(r) if r.status().is_success() => r,
            // Offline, timeout, 4xx/5xx — all fail closed to Unreachable.
            _ => return GateOutcome::Unreachable,
        };

        // The body is expected to carry the authoritative role string. Any shape
        // we cannot read as one of the three roles is treated as not-confirmed.
        let body = match resp.text() {
            Ok(b) => b,
            Err(_) => return GateOutcome::Unreachable,
        };
        parse_recheck_role(&body)
            .map(GateOutcome::Confirmed)
            .unwrap_or(GateOutcome::Unreachable)
    }
}

/// Extract the confirmed role from a re-check response body. Pure, no network, so
/// it is unit-testable. Accepts either a bare role string or a JSON object with a
/// top-level `role` field. Anything else => `None` (not confirmed).
fn parse_recheck_role(body: &str) -> Option<Role> {
    let trimmed = body.trim().trim_matches('"');
    if let Ok(role) = Role::from_claim(trimmed) {
        return Some(role);
    }
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    let role_str = value.get("role")?.as_str()?;
    Role::from_claim(role_str).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bare_role_string() {
        assert_eq!(parse_recheck_role("teacher"), Some(Role::Teacher));
        assert_eq!(parse_recheck_role("\"admin\""), Some(Role::Admin));
    }

    #[test]
    fn parses_json_role_field() {
        assert_eq!(
            parse_recheck_role(r#"{"role":"student","other":1}"#),
            Some(Role::Student)
        );
    }

    #[test]
    fn rejects_unknown_or_garbage() {
        assert_eq!(parse_recheck_role("superuser"), None);
        assert_eq!(parse_recheck_role("not json and not a role"), None);
        assert_eq!(parse_recheck_role(r#"{"role":"root"}"#), None);
    }
}
