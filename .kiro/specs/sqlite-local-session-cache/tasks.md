# Implementation Plan: SQLite Local Session Cache

## Overview

Convert the design into incremental Rust tasks for the new `auth` module, a
sibling to the existing core (`loader` / `scoring` / `module_store` / `normalize`
/ `model` / `commands`) under `Syndes/src-tauri/src`, wired through `commands.rs`
and `invoke_handler` in `lib.rs`.

The sequencing honors the design's **MODULAR BUILD ORDER** exactly:

1. **Foundations** — SQLite schema + `Session_Store` (raw reads, no trust) and
   typed `AuthError` + `AppError` integration.
2. **Layer 1 (the FLOOR)** — `Online_Gate`. Build and wire this as the **sole**
   working enforcement first: privileged action requires online re-check; offline
   ⇒ Student read-only. Zero crypto.
3. **Layer 2 (removable enhancement)** — `Auth_Seam` (JWKS fetch + login write)
   then `JWT_Verifier` (offline signature + `exp`), layered **on top of** Layer 1.
4. **Grace fallback** — the `auth` orchestrator composing verify → online gate →
   Student read-only, strictly descending, plus the Tauri commands.
5. **Property tests + integration test** — P1/P4, P2, P6, and the end-to-end
   offline flow mirroring the existing `lib.rs` e2e test.

Each task builds on the prior ones and ends with the project building and tests
passing. The implementation language is **Rust** (the design is written in Rust;
no pseudocode language choice is required). Reuse the existing `serde` /
`serde_json` and `reqwest` (`blocking` + `rustls-tls`) dependencies; add a JWT
crate (`jsonwebtoken` or similar) and a SQLite crate (`rusqlite` or a Tauri SQL
plugin).

## Tasks

- [ ] 1. Add dependencies and scaffold the `auth` module
  - [ ] 1.1 Add crates and create the `auth` module tree
    - Add a JWT crate (`jsonwebtoken` or similar) and a SQLite crate (`rusqlite`,
      with a bundled feature, or a Tauri SQL plugin) to `src-tauri/Cargo.toml`;
      reuse the already-present `serde`/`serde_json` and `reqwest` (`blocking` +
      `rustls-tls`) rather than adding a second HTTP client.
    - Create `src-tauri/src/auth/mod.rs` and declare submodules `session_store`,
      `verify`, `gate`, `seam` (empty stubs for now); add `mod auth;` to `lib.rs`.
    - Confirm the crate still builds (`cargo build`) with the new, empty module tree.
    - _Requirements: 1, 8_

- [ ] 2. Define `AuthError`, `Role`, and the IPC payload types; integrate with `AppError`
  - [ ] 2.1 Define `AuthError`, `Role`, `AuthContext`, `AuthSource` in `auth`
    - Define `AuthError` (serde `tag = "kind"`, `content = "message"`,
      `rename_all = "camelCase"`) with the eight variants `NoCachedSession`,
      `JwksParseError`, `SignatureInvalid`, `TokenExpired`, `MalformedToken`,
      `MissingJwks`, `StorageError`, `NetworkError`, each carrying exactly one
      human-readable message string.
    - Define `Role { Student, Teacher, Admin }` with `role_to_str` / `role_from_str`
      helpers restricted to `student|teacher|admin`.
    - Define `VerifiedClaims { sub, email, role, exp }` and the IPC payloads
      `AuthContext { role, read_only, source }` and
      `AuthSource { OnlineVerified, OfflineVerified, OnlineGate, StudentReadOnly }`,
      both `#[serde(rename_all = "camelCase")]` to match the existing boundary.
    - _Requirements: 8.1, 8.6_

  - [ ] 2.2 Map `AuthError` into the `AppError` shape at the boundary
    - Add an `AuthError` variant (or `From<AuthError>` conversion) to `AppError`
      in `model.rs` so the command boundary returns the existing `AppError` shape
      with a `kind` field equal to the originating `AuthError` variant name.
    - Ensure messages never carry the access token, JWKS material, or decoded
      claims (no-secret discipline); `AuthError` must never panic or unwind.
    - _Requirements: 8.2, 8.4, 8.5, 8.6_

  - [ ]* 2.3 Write unit tests for error typing and serialization
    - Assert each `AuthError` serializes to the expected `kind`/`message` JSON and
      maps to `AppError` with the matching `kind`.
    - Assert no message field contains token/JWKS/claim material.
    - _Requirements: 8.1, 8.2, 8.4_

- [ ] 3. Implement `auth::session_store` (SQLite schema + raw session access)
  - [ ] 3.1 Create/migrate schema and confirm app-data tables
    - Open the SQLite database; create/migrate the `cached_session` table with the
      exact columns (`user_id` text primary key, `email` text not null, `role` text
      not null `check (role in ('student','teacher','admin'))`, `access_token` text
      not null, `jwks_cache` text not null, `cached_at` integer not null, `token_exp`
      integer not null).
    - Confirm the Rust_Core app-data tables (`modules`, `attempts`, `scores`,
      `drafts`) exist without altering their shape; on any missing table return an
      error identifying each missing table and modify no existing schema.
    - _Requirements: 1.1, 1.2, 1.5, 1.6_

  - [ ] 3.2 Implement the `SessionStore` trait (load / store / clear)
    - Implement `store_cached_session` as a single-row-per-`user_id` upsert
      (replace prior row, never duplicate); reject any `role` outside
      `student|teacher|admin` with a `StorageError`, leaving any prior row
      unchanged; map SQLite I/O failures to `StorageError` with no partial write.
    - Implement `load_cached_session` to return the raw stored values verbatim with
      **no** verification or trust decision; return an empty result (no row, no
      error) when the `user_id` has no stored row.
    - Implement `clear_cached_session` for logout / corruption recovery.
    - Keep all `cached_session` reads/writes behind this one module so no other
      code reads `role` directly.
    - _Requirements: 1.3, 1.4, 1.7, 1.8, 1.9, 1.10, 8.3_

  - [ ]* 3.3 Write unit tests for `session_store`
    - Upsert replaces the row for an existing `user_id` (no duplicates); invalid
      `role` write is rejected and leaves any prior row unchanged.
    - `load` returns raw values and returns empty for a missing `user_id` without
      creating a row or erroring; missing app-data tables are reported by name.
    - SQLite failure surfaces as `StorageError` with no partial write.
    - _Requirements: 1.3, 1.4, 1.9, 1.10, 8.3_

- [ ] 4. Checkpoint — foundations build and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement `auth::gate` — Layer 1, the FLOOR (zero crypto)
  - [ ] 5.1 Implement the `OnlineGate` re-check
    - Implement `recheck(access_token) -> GateOutcome { Confirmed(Role), Unreachable }`
      using the existing `reqwest` blocking client with a bounded timeout.
    - A privileged action requires a completed online re-check: on success return
      `Confirmed(role)`; on timeout / unreachable / failed re-check return
      `Unreachable` (treat the caller as offline) and leave existing access
      unchanged. No cryptographic verification anywhere in this layer.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 5.2 Wire a minimal Layer-1-only resolution path and command
    - Add a provisional `resolve_access` that uses the gate alone (no verify layer
      yet): privileged ⇒ online re-check; `Unreachable`/offline ⇒ Student
      read-only (`StudentReadOnly`, "Connect to continue"). This makes Layer 1 the
      sole working enforcement before Layer 2 exists.
    - Register `auth_resolve_role` and `auth_logout` Tauri commands in `commands.rs`
      and `invoke_handler` in `lib.rs`, returning the `AppError` shape.
    - _Requirements: 5.1, 5.5, 5.7_

  - [ ]* 5.3 Write unit tests for the Layer-1 floor
    - Gate `Confirmed` ⇒ privileged allowed; `Unreachable` ⇒ Student read-only
      and every privileged action denied.
    - Resolution with no verify layer never grants broader than Student read-only
      while offline.
    - _Requirements: 5.4, 5.5, 5.7_

- [ ] 6. Checkpoint — Layer 1 floor works as sole enforcement
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement `auth::seam` — JWKS fetch + online login write (Layer 2 input)
  - [ ] 7.1 Validate the token claim contract
    - Decode the token claims and accept only when `sub`, `email`, `role`
      (`student|teacher|admin`), and `exp` are all present and well-formed; reject
      a token missing any claim or carrying an out-of-range `role` with an invalid
      token-contract error, caching nothing and leaving any prior session
      unchanged.
    - Accept a JWKS URL referencing the Supabase `/auth/v1/.well-known/jwks.json`
      endpoint.
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 7.2 Implement `store_session_online` (fetch JWKS → verify → persist)
    - Fetch the JWKS from the JWKS URL **while online** (via `reqwest` blocking)
      before any verification or write; on fetch failure return `NetworkError`,
      retain the previously cached JWKS, and write no `cached_session` row.
    - Verify the token signature against the freshly fetched keys and `exp` against
      the Device_Clock **before** writing anything; on any verify failure write no
      row, leave any existing row unchanged, and return an `AuthError` carrying no
      role.
    - On success persist exactly one `cached_session` row (upsert via
      `session_store`) with `user_id`=`sub`, `email`, `role` string from the
      In_Token_Role, `access_token`, `jwks_cache` = fetched keys, `cached_at` = now,
      `token_exp` = token `exp`; return `AuthContext { source: OnlineVerified }`.
    - Register the `auth_online_login` Tauri command in `commands.rs` and
      `invoke_handler` in `lib.rs`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.4, 7.5, 7.6_

  - [ ]* 7.3 Write unit tests for the seam
    - Verify-fail ⇒ nothing written and prior row unchanged; verify-ok ⇒ exactly
      one row with `token_exp == claim.exp`; JWKS fetch failure ⇒ `NetworkError`
      with prior JWKS retained; missing/invalid claim ⇒ invalid-contract rejection.
    - _Requirements: 2.3, 2.5, 2.6, 7.2, 7.5_

- [ ] 8. Implement `auth::verify` — Layer 2, offline JWT verify (removable)
  - [ ] 8.1 Implement JWKS parsing and `kid` key selection
    - Parse `jwks_cache` JSON into usable public keys; when more than one key is
      present, select the verifying key by matching the token header `kid` against
      the cached keys. Empty `jwks_cache` ⇒ `MissingJwks`; unparseable ⇒
      `JwksParseError`.
    - _Requirements: 3.2, 3.8, 3.9_

  - [ ] 8.2 Implement `verify_jwt` (signature + `exp` with clock-skew, deterministic ordering)
    - Verify the signature against the selected JWKS key and check `exp` against the
      Device_Clock minus a clock-skew tolerance; on full success return
      `VerifiedClaims` and read the role **only** from the token (never the
      Loose_Role). No SQLite reads, no side effects, never panics.
    - Evaluate failure causes in the fixed order `NoCachedSession` → `MissingJwks`
      → `JwksParseError` → `MalformedToken` → `SignatureInvalid` → `TokenExpired`
      and return the first matching cause as a single typed `AuthError`.
    - _Requirements: 3.1, 3.3, 3.4, 3.6, 3.10, 3.11, 3.12_

  - [ ]* 8.3 Write unit tests for `verify_jwt`
    - Valid token ⇒ `Ok` with in-token role; tampered signature ⇒ `SignatureInvalid`;
      expired `exp` ⇒ `TokenExpired`; malformed token ⇒ `MalformedToken`;
      empty/garbled JWKS ⇒ `MissingJwks`/`JwksParseError`; multi-cause input returns
      the first cause in the fixed order.
    - _Requirements: 3.6, 3.10, 3.11, 3.12_

  - [ ]* 8.4 Write the tampered-role-column unit test
    - A `cached_session` with `role='admin'` but a token whose claim is `student`
      ⇒ resolved role is `student`; the Loose_Role column never influences the
      decision.
    - _Requirements: 3.4, 4.3_

- [ ] 9. Implement the `auth` orchestrator + grace fallback (compose Layer 2 → Layer 1 → floor)
  - [ ] 9.1 Implement `verify_cached_role` and the full `resolve_access` ladder
    - Implement `verify_cached_role` = load raw session → parse JWKS → `verify_jwt`,
      trusting only the in-token role.
    - Replace the provisional Layer-1-only `resolve_access` with the full
      strictly-descending ladder: offline verify (`OfflineVerified`,
      `readOnly=false`) → on any verify failure, online gate (`OnlineGate`) → on
      unreachable gate, Student read-only (`StudentReadOnly`, "Connect to
      continue"). Never derive, assign, or elevate a role from the Loose_Role at
      any step; default to `StudentReadOnly` if any step fails to produce a
      verified context.
    - Keep the fallback chain in exactly one place so it cannot drift; confirm the
      already-registered `auth_resolve_role` / `auth_online_login` / `auth_logout`
      commands route through it.
    - _Requirements: 3.5, 3.7, 3.13, 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.7_

  - [ ]* 9.2 Write unit tests for `resolve_access` branches
    - Table-drive each branch (offline-verified; verify-fail + gate-confirmed;
      verify-fail + gate-unreachable) asserting `source`, `readOnly`, and that
      strictness is monotonic (`OfflineVerified` ≥ `OnlineGate` ≥
      `StudentReadOnly`).
    - _Requirements: 4.5, 4.6, 4.7, 6.2, 6.3, 6.5_

- [ ] 10. Checkpoint — full fallback composition builds and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Property-based tests (`proptest`) for the design's correctness properties
  - [ ]* 11.1 Property test for P1 / P4 — no trust without proof, never fail open
    - **Property 1: No trust without proof** and **Property 4: Never fail open**
    - For arbitrary `cached_session.role` strings paired with a token whose claim
      is a generated role, when verify succeeds the resolved role always equals the
      token claim and never the column; no path derives a privileged role from the
      Loose_Role without a signature verify or live gate confirmation.
    - **Validates: Requirements 2.4, 3.4, 3.5, 4.1, 4.3, 4.4, 6.4**

  - [ ]* 11.2 Property test for P2 — fail toward more verification
    - **Property 2: Fail toward more verification**
    - For arbitrary verify-failure causes, the result `source` is always in
      `{OnlineGate, StudentReadOnly}` and never the loose cached role.
    - **Validates: Requirements 6.1, 6.2, 6.5**

  - [ ]* 11.3 Property test for P6 — removable layer
    - **Property 6: Removable layer**
    - With Layer 2 (`auth::verify`) disabled, every privileged resolution offline
      yields read-only Student and each privileged action requires an online
      re-check.
    - **Validates: Requirements 5.1, 5.7**

- [ ] 12. Integration test mirroring the existing `lib.rs` e2e flow
  - [ ]* 12.1 End-to-end offline session-cache flow
    - Online login (store token + JWKS) → offline app start resolves
      `OfflineVerified` → advance the device clock past `exp` → resolve drops to the
      online gate → still offline ⇒ `StudentReadOnly` read-only + "Connect to
      continue", mirroring the existing `#[cfg(test)] mod e2e` structure in
      `lib.rs`.
    - _Requirements: 3.5, 4.6, 5.5, 6.1, 6.3_

- [ ] 13. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP;
  core implementation tasks are never optional.
- The build order is strict: Layer 1 (`auth::gate`) ships as the sole working
  enforcement first (tasks 5–6), Layer 2 (`seam` + `verify`) is layered on top as
  a removable enhancement (tasks 7–8), and the grace fallback composes them last
  (task 9). This order is not inverted.
- Each task references specific requirement / acceptance-criteria numbers for
  traceability.
- Property tests use `proptest` and validate the design's universal correctness
  properties P1/P4, P2, and P6; unit tests cover specific examples and the
  tampered-column edge case.
- All `cached_session` access stays behind `auth::session_store`; only
  `auth::verify` / `auth::gate` may influence a trust decision. No secret material
  (token, JWKS, decoded claims) is ever logged.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["2.3", "3.2"] },
    { "id": 4, "tasks": ["3.3", "5.1"] },
    { "id": 5, "tasks": ["5.2", "7.1"] },
    { "id": 6, "tasks": ["5.3", "7.2", "8.1"] },
    { "id": 7, "tasks": ["7.3", "8.2"] },
    { "id": 8, "tasks": ["8.3", "8.4"] },
    { "id": 9, "tasks": ["9.1"] },
    { "id": 10, "tasks": ["9.2", "11.1", "11.2", "11.3"] },
    { "id": 11, "tasks": ["12.1"] }
  ]
}
```
