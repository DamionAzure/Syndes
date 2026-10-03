# Requirements Document

## Introduction

The SQLite Local Session Cache gives the Acassist Tauri desktop app an
offline-first authentication cache. After a single online login, the app caches
the role that Supabase already decided so the app keeps working offline. SQLite
never *decides* a role — it caches one. The role column lives on the user's
device and is attacker-writable, so it is treated as a cache, never an authority:
a role is trusted only when the signed Supabase JWT that accompanies it verifies
(signature first, then `exp`, then the in-token `role` claim).

The feature is built in strict layers so the demo-safe thing ships first. Layer 1
is an online re-check gate (the floor): a secure app with zero crypto. Layer 2 is
offline JWT verification, layered on top as a removable enhancement. A grace
fallback always fails toward *more* verification: a failed verify drops to the
stricter online gate, and an unreachable gate drops to Student-scoped read-only —
never to trusting the loose cached role.

The new `auth` module is a sibling to the existing offline-first Rust core
(`loader` / `scoring` / `module_store` / `normalize` / `commands`) under
`Syndes/src-tauri/src`, wired through the same Tauri v2 command boundary pattern,
reusing the existing `AppError`-shaped typed-error style and the already-present
`reqwest` / `serde` dependencies.

## Glossary

- **Auth_Module**: The new Rust `auth` module that owns the `cached_session`
  table, JWKS fetch/cache, offline JWT verification, the online re-check gate,
  and the grace fallback chain.
- **Session_Store**: The sub-component (`auth::session_store`) that is the only
  module permitted to read or write `cached_session` rows. Reads return raw
  bytes with no trust decision applied.
- **JWT_Verifier**: The sub-component (`auth::verify`) that verifies a JWT
  signature against cached JWKS keys and checks `exp` — Layer 2, the trusted
  layer.
- **Online_Gate**: The sub-component (`auth::gate`) that re-checks Supabase for a
  privileged action — Layer 1, the floor.
- **Auth_Seam**: The sub-component (`auth::seam`) that fetches and caches JWKS
  while online and persists the session after a successful online login.
- **Command_Boundary**: The Tauri v2 command layer (`commands.rs`, registered via
  `invoke_handler` in `lib.rs`) that exposes `Auth_Module` to the webview.
- **Rust_Core**: The existing offline-first core (`loader`, `scoring`,
  `module_store`, `normalize`, `model`, `commands`) that owns local app data.
- **cached_session**: The single-row SQLite table caching the verified session
  (`user_id`, `email`, `role`, `access_token`, `jwks_cache`, `cached_at`,
  `token_exp`).
- **Access_Token**: The signed Supabase JWT. The source of role truth. Claims:
  `sub`, `email`, `role` (`student|teacher|admin`), `exp`.
- **JWKS**: The Supabase public keys used to verify the Access_Token signature,
  fetched from the Supabase JWKS URL (`/auth/v1/.well-known/jwks.json`).
- **Loose_Role**: The `cached_session.role` text column — a display convenience
  copied from a once-verified token. Attacker-writable on-device; never an
  authority.
- **In_Token_Role**: The `role` claim read from inside a verified Access_Token.
  The only trusted source of role.
- **Device_Clock**: The local machine clock, the sole truth for `exp` while
  offline.
- **AuthContext**: The resolved access decision returned to the UI (`role`,
  `readOnly`, `source`).
- **AuthError**: The typed auth failure enum (serde-tagged, `AppError`-shaped).
- **Student_Read_Only**: The floor outcome — role Student, read-only, UI shows
  "Connect to continue".
- **Privileged_Action**: A Teacher or Admin action (such as a write) that
  requires a trusted non-Student role.

## Requirements

### Requirement 1: Local SQLite schema

**User Story:** As a developer of the Rust core, I want a well-defined local
SQLite schema that caches a session and holds local app data, so that the app
works offline after one online login without SQLite ever becoming a role
authority.

#### Acceptance Criteria

1. THE Session_Store SHALL define a `cached_session` table with columns `user_id` (text primary key), `email` (text), `role` (text), `access_token` (text), `jwks_cache` (text), `cached_at` (integer unix seconds), and `token_exp` (integer unix seconds).
2. THE Session_Store SHALL constrain the `role` column with a check constraint permitting only the values `student`, `teacher`, and `admin`.
3. IF a write to the `cached_session` table supplies a `role` value other than `student`, `teacher`, or `admin`, THEN THE Session_Store SHALL reject the write, retain any previously stored row unchanged, and return a `StorageError` indicating the role value is invalid.
4. THE Session_Store SHALL enforce that the `cached_session` table holds at most one row per `user_id`, such that writing a session for an existing `user_id` replaces the prior row rather than creating a duplicate.
5. THE Session_Store SHALL confirm the local app-data tables (`modules`, `attempts`, `scores`, `drafts`) owned by the Rust_Core exist, without taking ownership of their shape.
6. IF one or more of the required Rust_Core app-data tables (`modules`, `attempts`, `scores`, `drafts`) do not exist when existence is confirmed, THEN THE Session_Store SHALL return an error identifying each missing table and SHALL make no modification to the schema of any existing table.
7. THE Session_Store SHALL treat the `cached_session.role` column as a cache for display, never as an authority for access decisions.
8. THE Rust_Core app-data tables SHALL store no role authority and SHALL never be read for a trust decision.
9. WHEN loading a `cached_session` row, THE Session_Store SHALL return the raw stored values for `user_id`, `email`, `role`, `access_token`, `jwks_cache`, `cached_at`, and `token_exp` without applying any verification or trust decision.
10. WHEN loading a `cached_session` row for a `user_id` that has no stored row, THE Session_Store SHALL return an empty result indicating no cached session exists, without creating a row or raising an error.

### Requirement 2: Online login seam write

**User Story:** As a user who just logged in online, I want my verified session
cached locally, so that I can keep using the app offline, while the system
guarantees nothing is stored unless the token actually verified.

#### Acceptance Criteria

1. WHEN an online login succeeds, THE Auth_Seam SHALL fetch the JWKS from the Supabase JWKS URL while the device has network connectivity, before performing any token verification or any write to the `cached_session` table.
2. WHEN the JWKS has been fetched, THE Auth_Seam SHALL verify the Access_Token signature against the freshly fetched JWKS keys and SHALL verify that the token `exp` claim is in the future relative to the Device_Clock, before writing any `cached_session` row.
3. WHEN the online verify succeeds, THE Auth_Seam SHALL persist exactly one `cached_session` row keyed by `user_id`, storing `user_id` from the token `sub` claim, `email` from the token `email` claim, the `role` string from the In_Token_Role, `access_token`, `jwks_cache` containing the freshly fetched JWKS keys, `cached_at` as the current unix-seconds timestamp, and `token_exp` set from the token `exp` claim.
4. WHEN the `cached_session` row has been persisted, THE Auth_Seam SHALL return an AuthContext whose role is the In_Token_Role and whose source is `OnlineVerified`.
5. IF the online verify fails for any reason, THEN THE Auth_Seam SHALL write no `cached_session` row, SHALL leave any existing `cached_session` row unchanged, and SHALL return an AuthError that carries no role.
6. IF the JWKS fetch cannot reach the Supabase JWKS URL, THEN THE Auth_Seam SHALL return a `NetworkError`, SHALL write no `cached_session` row, and SHALL leave any existing `cached_session` row unchanged.

### Requirement 3: Offline JWT verify path (Layer 2)

**User Story:** As a returning offline user, I want the app to verify my cached
token locally, so that my real role is trusted offline only when the signature
and expiry prove it.

#### Acceptance Criteria

1. WHEN resolving access on app start or before a Privileged_Action, THE JWT_Verifier SHALL read `access_token` and `jwks_cache` from the `cached_session` row.
2. WHEN the `jwks_cache` holds more than one key, THE JWT_Verifier SHALL select the verifying key by matching the token header key id (`kid`) against the cached keys.
3. WHEN verifying, THE JWT_Verifier SHALL verify the Access_Token signature against the selected cached JWKS key and SHALL treat the token as expired when the token `exp` claim is earlier than the Device_Clock time minus a clock-skew tolerance.
4. WHEN the signature and `exp` are both valid, THE JWT_Verifier SHALL return the In_Token_Role and SHALL NOT read the Loose_Role.
5. WHEN the offline verify succeeds, THE Auth_Module SHALL return an AuthContext whose source is `OfflineVerified` and whose `readOnly` is false.
6. WHEN more than one failure condition applies to a single verification, THE JWT_Verifier SHALL evaluate causes in a fixed order (`NoCachedSession`, then `MissingJwks`, then `JwksParseError`, then `MalformedToken`, then `SignatureInvalid`, then `TokenExpired`) and return the first matching cause as a single typed AuthError.
7. IF no `cached_session` row exists, THEN THE JWT_Verifier SHALL return `NoCachedSession` and no role.
8. IF the `jwks_cache` is empty, THEN THE JWT_Verifier SHALL return `MissingJwks` and no role.
9. IF the `jwks_cache` cannot be parsed into public keys, THEN THE JWT_Verifier SHALL return `JwksParseError` and no role.
10. IF the Access_Token is unparseable, THEN THE JWT_Verifier SHALL return `MalformedToken` and no role.
11. IF the Access_Token signature does not match the selected cached JWKS key, THEN THE JWT_Verifier SHALL return `SignatureInvalid` and no role.
12. IF the Access_Token `exp` has passed on the Device_Clock beyond the clock-skew tolerance, THEN THE JWT_Verifier SHALL return `TokenExpired` and no role.
13. IF the offline verify fails for any cause, THEN THE Auth_Module SHALL NOT return an AuthContext sourced from the Loose_Role and SHALL leave any existing `cached_session` row unchanged.

### Requirement 4: Leak-prevention invariant

**User Story:** As a security reviewer, I want a guarantee that an edited local
role cannot grant access, so that opening the SQLite file and setting
`role = 'admin'` is a no-op.

#### Acceptance Criteria

1. THE Auth_Module SHALL base every access decision on either a successful Access_Token signature verification by the JWT_Verifier or a recent Online_Gate confirmation, and SHALL NOT grant access based on the Loose_Role value.
2. WHILE resolving access, THE Auth_Module SHALL treat a role as valid only when the accompanying Access_Token signature verifies and the token is unexpired.
3. WHERE a `cached_session` row has a Loose_Role that differs from the In_Token_Role, THE Auth_Module SHALL use the In_Token_Role for the access decision and SHALL ignore the Loose_Role.
4. THE Auth_Module SHALL route every read that influences a trust decision through the JWT_Verifier or the Online_Gate, such that no access decision branches on the Loose_Role.
5. IF the Access_Token signature verification fails, THEN THE Auth_Module SHALL deny access, SHALL NOT fall back to the Loose_Role, and SHALL return a response indicating the session is invalid.
6. IF the Access_Token is expired and no recent Online_Gate confirmation is available, THEN THE Auth_Module SHALL deny access and SHALL return a response indicating re-authentication is required.
7. IF the Online_Gate is unreachable and no verifiable unexpired Access_Token is present, THEN THE Auth_Module SHALL deny access and SHALL NOT grant access based on any `cached_session` field.

### Requirement 5: Modular build order

**User Story:** As a team shipping a demo, I want the online gate to be the floor
and the JWT verify layer to be removable, so that deleting Layer 2 still leaves a
working secure app.

#### Acceptance Criteria

1. THE Online_Gate SHALL function as the sole enforcement layer with zero cryptographic verification.
2. WHEN a Privileged_Action is requested, THE Online_Gate SHALL re-check Supabase for the role decision before granting access.
3. WHILE a connection probe to Supabase does not complete within its timeout, THE Online_Gate SHALL treat the caller as offline.
4. IF the Supabase role re-check for a Privileged_Action fails or does not return within its timeout, THEN THE Online_Gate SHALL deny the Privileged_Action, return an error indicating the role decision could not be verified, and leave existing caller access unchanged.
5. WHILE offline, THE Online_Gate SHALL scope callers to Student read-only access and SHALL deny every Privileged_Action.
6. THE JWT_Verifier SHALL be layered on top of the Online_Gate as a removable enhancement.
7. WHERE the JWT_Verifier is removed, THE Auth_Module SHALL resolve access using the Online_Gate alone, requiring a successful Supabase role re-check for every Privileged_Action and scoping offline callers to Student read-only access.

### Requirement 6: Grace fallback

**User Story:** As a user whose cached token can no longer be verified, I want the
app to fall back to stricter checks, so that access always fails toward more
verification and never toward trusting a local role.

#### Acceptance Criteria

1. WHEN the offline JWT verify fails for any reason, including signature mismatch, expiration, malformed structure, or missing required claims, THE Auth_Module SHALL fall back to the Online_Gate re-check and SHALL record the failure-cause category without logging any secret material.
2. WHEN the Online_Gate re-check completes successfully, THE Auth_Module SHALL return an AuthContext whose source is `OnlineGate`.
3. IF the offline JWT verify fails and the Online_Gate is unreachable, THEN THE Auth_Module SHALL present "Connect to continue" and SHALL grant Student-scoped read-only access in an AuthContext whose source is `StudentReadOnly`.
4. WHILE performing any fallback step, THE Auth_Module SHALL NOT derive, assign, or elevate any role based on the Loose_Role value.
5. THE Auth_Module SHALL enforce the fallback order strictly descending as `OfflineVerified`, then `OnlineGate`, then `StudentReadOnly`, such that each step grants access that is a subset of or equal to the access granted by the step above it, and SHALL NOT grant access broader than Student-scoped read-only in any fallback outcome.
6. IF any fallback step fails to produce a verified AuthContext, THEN THE Auth_Module SHALL default to `StudentReadOnly` access.

### Requirement 7: Seam / input contract with Spec A

**User Story:** As the integration owner, I want a defined input contract with the
Supabase (Spec A) side, so that the token and JWKS flow into the cache correctly.

#### Acceptance Criteria

1. WHEN an Access_Token (JWT) is submitted to the seam, THE Auth_Seam SHALL accept it only if it carries the claims `sub`, `email`, `role` (one of `student|teacher|admin`), and `exp`.
2. IF a submitted Access_Token is missing any of the claims `sub`, `email`, `role`, or `exp`, or the `role` claim holds a value other than `student`, `teacher`, or `admin`, THEN THE Auth_Seam SHALL reject the token without caching it and return an error indicating an invalid token contract, leaving any previously cached session unchanged.
3. THE Auth_Seam SHALL accept a JWKS URL referencing the Supabase endpoint `/auth/v1/.well-known/jwks.json`.
4. WHILE online, THE Auth_Seam SHALL fetch and cache the JWKS so that offline verification has keys available.
5. IF the online JWKS fetch fails, THEN THE Auth_Seam SHALL retain the previously cached JWKS and return a `NetworkError` indicating the JWKS fetch failed.
6. WHEN an online login succeeds, THE Auth_Seam SHALL store the Access_Token in the `cached_session` row.
7. WHEN verifying offline, THE Auth_Module SHALL trust only the In_Token_Role and SHALL NOT assign, decide, or write any role authority of its own.

### Requirement 8: Error handling and security

**User Story:** As a developer and security reviewer, I want typed auth errors and
strict secret handling, so that failures are legible and no secrets leak.

#### Acceptance Criteria

1. THE Auth_Module SHALL represent auth failures as the typed AuthError variants `NoCachedSession`, `JwksParseError`, `SignatureInvalid`, `TokenExpired`, `MalformedToken`, `MissingJwks`, `StorageError`, and `NetworkError`, where each returned AuthError carries exactly one variant and a human-readable message that excludes the Access_Token, JWKS material, and decoded claims.
2. WHEN an AuthError is surfaced through the Command_Boundary, THE Auth_Module SHALL return it in the existing `AppError` shape with a `kind` field whose value equals the corresponding AuthError variant name.
3. IF a SQLite read or write operation fails, THEN THE Session_Store SHALL return a `StorageError` and SHALL leave the stored session row unchanged with no partial write persisted.
4. THE Auth_Module SHALL exclude the Access_Token, JWKS material, and decoded claims from all log output at every log level.
5. THE Auth_Module SHALL treat the SQLite database file as sensitive because it holds a bearer credential at rest, and SHALL exclude the Access_Token value from all log output and all AuthError messages.
6. IF any auth operation fails, THEN THE Auth_Module SHALL return exactly one typed AuthError variant and SHALL NOT panic, abort the process, or unwind across the Command_Boundary.
