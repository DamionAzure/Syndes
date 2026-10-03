use crate::auth::AuthError;

/// Public project coordinates are compiled into the desktop binary. The webview
/// cannot choose a verifier or change which Supabase project grants access.
#[derive(Clone)]
pub struct ProjectConfig {
    pub issuer: String,
    pub jwks_url: String,
    pub account_access_url: String,
    pub publishable_key: String,
}

impl ProjectConfig {
    pub fn configured() -> Result<Self, AuthError> {
        let url = option_env!("SYNDES_SUPABASE_URL")
            .or(option_env!("NEXT_PUBLIC_SUPABASE_URL"))
            .ok_or_else(|| {
                AuthError::NetworkError(
                    "Supabase project URL is not configured in this build".into(),
                )
            })?;
        let key = option_env!("SYNDES_SUPABASE_PUBLISHABLE_KEY")
            .or(option_env!("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
            .ok_or_else(|| {
                AuthError::NetworkError(
                    "Supabase publishable key is not configured in this build".into(),
                )
            })?;
        let parsed = reqwest::Url::parse(url)
            .map_err(|_| AuthError::NetworkError("Supabase project URL is invalid".into()))?;
        let local = matches!(parsed.host_str(), Some("localhost" | "127.0.0.1"));
        if !matches!(parsed.scheme(), "https") && !(local && parsed.scheme() == "http") {
            return Err(AuthError::NetworkError(
                "Supabase project URL must use HTTPS".into(),
            ));
        }
        if parsed.username() != ""
            || parsed.password().is_some()
            || parsed.query().is_some()
            || parsed.fragment().is_some()
        {
            return Err(AuthError::NetworkError(
                "Supabase project URL has unexpected components".into(),
            ));
        }
        if parsed.path() != "/" {
            return Err(AuthError::NetworkError(
                "Supabase project URL must be the project root".into(),
            ));
        }
        let base = url.trim_end_matches('/');
        Ok(Self {
            issuer: format!("{base}/auth/v1"),
            jwks_url: format!("{base}/auth/v1/.well-known/jwks.json"),
            account_access_url: format!("{base}/rest/v1/rpc/current_account_access"),
            publishable_key: key.to_string(),
        })
    }

    #[cfg(test)]
    pub fn test() -> Self {
        let base = "https://test-project.supabase.co";
        Self {
            issuer: format!("{base}/auth/v1"),
            jwks_url: format!("{base}/auth/v1/.well-known/jwks.json"),
            account_access_url: format!("{base}/rest/v1/rpc/current_account_access"),
            publishable_key: "test-publishable-key".into(),
        }
    }
}
