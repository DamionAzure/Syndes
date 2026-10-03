# MVP Account sign-in setup

Syndes uses Supabase Auth with PKCE. Student and Teacher entry pages use the same identity provider; an entry page does not assign a role. An Administrator approves learning access and assigns Teacher permission separately in Supabase. The app has no self-promotion control.

## Supabase project

1. Enable the school's configured SSO provider when one exists and set `NEXT_PUBLIC_SYNDES_SCHOOL_SSO_DOMAIN` to its domain. Otherwise enable Google in Supabase Auth. The Syndes project currently has neither school SSO nor Google enabled, so this dashboard step is required before live sign-in works.
2. Add `syndes://auth/callback` to Supabase Auth's Redirect URLs. For local browser development add `http://localhost:1420/auth/callback`. Add the exact production web callback URL only if Syndes is deployed to a web origin.
3. For Google, configure the provider's authorized redirect URI as the project's `https://<project-ref>.supabase.co/auth/v1/callback` in Google Cloud, then enter its client credentials in Supabase Auth. Do not place the Google client secret in this repository or the desktop bundle.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the frontend build. Both are public client values. Never use a service-role key in the frontend.
5. Set `SYNDES_SUPABASE_URL` and `SYNDES_SUPABASE_PUBLISHABLE_KEY` in the environment when building the Rust/Tauri core. The core accepts the exported `NEXT_PUBLIC_` values as a fallback; values stored only in the Next `.env` file do not reach Cargo.

The desktop opens the provider in the system browser and receives the one-time code through `syndes://auth/callback`. The webview exchanges that code using the same PKCE verifier that began sign-in. Rust verifies the resulting Supabase token and reads current Account access before it grants learning or Teacher actions. A new signed-in Account remains Pending until an Administrator approves it.

## Verification status

The current environment has no browser automation for the packaged Tauri app, and the school/Google provider is not configured yet. React component, Tauri command, and SQL policy seam tests cover the implemented rules; they do not prove the operating-system callback journey. After provider setup, manually check the installed app's callback on a cold start and while running, Pending access, approval, offline study after token expiry, Teacher authorization while online, Account switching, revocation on reconnection, and explicit sign-out. Record the results before rollout.
