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
    /// Online: Supabase re-confirmed the current role AND approval state for the
    /// Account. Both are read fresh from the live re-check, never from the device
    /// (ADR 0004: a privileged action needs a fresh online check; ADR 0007:
    /// revoked approval is enforced on reconnect).
    Confirmed { role: Role, approved: bool },
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

        // The body is expected to carry the authoritative role + approval. Any
        // shape we cannot read as one of the three roles is treated as
        // not-confirmed.
        let body = match resp.text() {
            Ok(b) => b,
            Err(_) => return GateOutcome::Unreachable,
        };
        parse_recheck_outcome(&body)
    }
}

/// Extract the confirmed role + approval from a re-check response body. Pure, no
/// network, so it is unit-testable. Accepts either a bare role string (approval
/// defaults to false — a bare role carries no approval signal, so fail closed) or
/// a JSON object with a top-level `role` field and an optional boolean `approved`
/// field. Anything we cannot read as a valid role => `Unreachable` (not confirmed).
fn parse_recheck_outcome(body: &str) -> GateOutcome {
    let trimmed = body.trim().trim_matches('"');
    if let Ok(role) = Role::from_claim(trimmed) {
        // A bare role string carries no approval claim; fail closed on approval.
        return GateOutcome::Confirmed { role, approved: false };
    }
    let value: serde_json::Value = match serde_json::from_str(body) {
        Ok(v) => v,
        Err(_) => return GateOutcome::Unreachable,
    };
    let role = match value.get("role").and_then(|r| r.as_str()).map(Role::from_claim) {
        Some(Ok(role)) => role,
        _ => return GateOutcome::Unreachable,
    };
    // Approval is explicit; absent or non-boolean => not approved (fail closed).
    let approved = value.get("approved").and_then(|a| a.as_bool()).unwrap_or(false);
    GateOutcome::Confirmed { role, approved }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bare_role_string_unapproved() {
        // A bare role carries no approval signal => approved is false (fail closed).
        assert_eq!(
            parse_recheck_outcome("teacher"),
            GateOutcome::Confirmed { role: Role::Teacher, approved: false }
        );
        assert_eq!(
            parse_recheck_outcome("\"admin\""),
            GateOutcome::Confirmed { role: Role::Admin, approved: false }
        );
    }

    #[test]
    fn parses_json_role_and_approval() {
        assert_eq!(
            parse_recheck_outcome(r#"{"role":"student","approved":true,"other":1}"#),
            GateOutcome::Confirmed { role: Role::Student, approved: true }
        );
        // Approved absent => not approved (fail closed).
        assert_eq!(
            parse_recheck_outcome(r#"{"role":"teacher"}"#),
            GateOutcome::Confirmed { role: Role::Teacher, approved: false }
        );
        // Approved explicitly false.
        assert_eq!(
            parse_recheck_outcome(r#"{"role":"teacher","approved":false}"#),
            GateOutcome::Confirmed { role: Role::Teacher, approved: false }
        );
    }

    #[test]
    fn rejects_unknown_or_garbage() {
        assert_eq!(parse_recheck_outcome("superuser"), GateOutcome::Unreachable);
        assert_eq!(parse_recheck_outcome("not json and not a role"), GateOutcome::Unreachable);
        assert_eq!(parse_recheck_outcome(r#"{"role":"root"}"#), GateOutcome::Unreachable);
    }
}
