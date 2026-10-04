use crate::auth::Role;
use serde::Deserialize;
use std::time::Duration;

const GATE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GateOutcome {
    Confirmed {
        role: Role,
        approved: bool,
        active: bool,
    },
    Unreachable,
}

pub trait OnlineGate {
    fn recheck(&self, access_token: &str, account_id: &str) -> GateOutcome;
}

pub struct SupabaseGate {
    recheck_url: String,
    publishable_key: String,
}

impl SupabaseGate {
    pub fn new(recheck_url: impl Into<String>, publishable_key: impl Into<String>) -> Self {
        Self {
            recheck_url: recheck_url.into(),
            publishable_key: publishable_key.into(),
        }
    }
}

impl OnlineGate for SupabaseGate {
    fn recheck(&self, access_token: &str, account_id: &str) -> GateOutcome {
        if self.recheck_url.is_empty() || self.publishable_key.is_empty() {
            return GateOutcome::Unreachable;
        }
        let client = match reqwest::blocking::Client::builder()
            .timeout(GATE_TIMEOUT)
            .build()
        {
            Ok(client) => client,
            Err(_) => return GateOutcome::Unreachable,
        };
        let response = client
            .post(&self.recheck_url)
            .bearer_auth(access_token)
            .header("apikey", &self.publishable_key)
            .json(&serde_json::json!({}))
            .send();
        let body = match response {
            Ok(response) if response.status().is_success() => match response.text() {
                Ok(body) => body,
                Err(_) => return GateOutcome::Unreachable,
            },
            _ => return GateOutcome::Unreachable,
        };
        parse_recheck_outcome(&body, account_id)
    }
}

#[derive(Deserialize)]
struct AccountAccess {
    account_id: String,
    role: String,
    approved: bool,
    active: bool,
}

fn parse_recheck_outcome(body: &str, expected_account_id: &str) -> GateOutcome {
    let access: AccountAccess = match serde_json::from_str(body) {
        Ok(access) => access,
        Err(_) => return GateOutcome::Unreachable,
    };
    if access.account_id != expected_account_id || expected_account_id.is_empty() {
        return GateOutcome::Unreachable;
    }
    if !access.active {
        return GateOutcome::Confirmed {
            role: Role::Student,
            approved: false,
            active: false,
        };
    }
    let role = match access.role.as_str() {
        "Student" => Role::Student,
        "Teacher" => Role::Teacher,
        "Administrator" => Role::Admin,
        _ => return GateOutcome::Unreachable,
    };
    GateOutcome::Confirmed {
        role,
        approved: access.approved,
        active: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_account_access_requires_matching_identity_and_active_state() {
        let approved =
            r#"{"account_id":"account-1","role":"Teacher","approved":true,"active":true}"#;
        assert_eq!(
            parse_recheck_outcome(approved, "account-1"),
            GateOutcome::Confirmed {
                role: Role::Teacher,
                approved: true,
                active: true
            }
        );
        assert_eq!(
            parse_recheck_outcome(approved, "account-2"),
            GateOutcome::Unreachable
        );
        let revoked =
            r#"{"account_id":"account-1","role":"Teacher","approved":true,"active":false}"#;
        assert_eq!(
            parse_recheck_outcome(revoked, "account-1"),
            GateOutcome::Confirmed {
                role: Role::Student,
                approved: false,
                active: false
            }
        );
    }

    #[test]
    fn pending_teacher_keeps_teacher_permission_separate_from_learning() {
        let pending =
            r#"{"account_id":"account-1","role":"Teacher","approved":false,"active":true}"#;
        assert_eq!(
            parse_recheck_outcome(pending, "account-1"),
            GateOutcome::Confirmed {
                role: Role::Teacher,
                approved: false,
                active: true
            }
        );
        let admin =
            r#"{"account_id":"account-1","role":"Administrator","approved":false,"active":true}"#;
        assert_eq!(
            parse_recheck_outcome(admin, "account-1"),
            GateOutcome::Confirmed {
                role: Role::Admin,
                approved: false,
                active: true
            }
        );
    }
}
