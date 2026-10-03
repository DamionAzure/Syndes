# Static Correctness Review — SQLite Local Session Cache (auth module)

**Mode:** read-only, static second pass. No code was modified, no `cargo`
invoked, no commit made. (No Rust toolchain on this machine by design.)

**Scope:** `Syndes/src-tauri/src/auth/{mod,session_store,verify,gate,seam}.rs`,
`commands.rs`, `lib.rs`, `model.rs`, `Cargo.toml`, reviewed against the three
spec files under `.kiro/specs/sqlite-local-session-cache/`.

---

## 1. Overall verdict

**Will it compile on a cargo machine? HIGH confidence YES.**
**Will the tests pass? MEDIUM–HIGH confidence YES.**

The strongest evidence is not just a read of the source — it is that this crate
*has already been compiled with these files present*. The build-dependency
fingerprints under `target/debug/deps/` list every auth file as a compiled input:

```
target/debug/deps/syndes_lib-2976046023da498f.d
target/debug/deps/syndes_lib-8193e8e0b2d709f1.d
  -> src\lib.rs src\auth\mod.rs src\auth\gate.rs src\auth\seam.rs
     src\auth\session_store.rs src\auth\verify.rs src\commands.rs ...
```

rustc only emits a `.d`/`.rmeta` pair after a compilation unit type-checks, so
the **non-test library path compiled cleanly** as recently as `2026-10-04 02:41`.

### The single most likely failure point (read this first)

`src/lib.rs` was modified at **02:42:10**, i.e. **~29 seconds AFTER the last
build artifact (02:41:41)**. Every *other* auth source file predates the build.
So the compiler has validated all of the auth module **except the final edit to
`lib.rs`** — specifically the `.setup(...)` closure that constructs
`SessionStore`, builds the `SupabaseGate`, and calls `app.manage(AuthState::new(...))`.

I read that closure carefully (see §3) and found no compile error, but it is the
one piece with *no compiler confirmation*. If anything fails to build on the
dev's machine, start there.

Second caveat: the artifacts present are **library metadata only** (`.d` +
`.rmeta`, ~1.2 KB each). There is **no linked test binary** (`syndes*.exe`) in
`deps/`. So we have evidence the library *type-checks*, but **no evidence that
`cargo test` was ever built or run.** The test modules (proptest, the RSA-minting
e2e) are reviewed statically below and look sound, but "tests pass" rests on
review, not on a prior run.

---

## 2. Compilation plausibility — detailed findings

### 2.1 Module tree and cross-file references — OK
- `lib.rs` declares `mod auth;`; `auth/mod.rs` declares
  `pub mod gate; pub mod seam; pub mod session_store; pub mod verify;` — all four
  files exist. ✔
- `AuthState { store: SessionStore, gate: Box<dyn OnlineGate + Send + Sync> }`
  and `AuthState::new` in `mod.rs` match the construction in `lib.rs` and the
  usage in `commands.rs`. ✔
- `commands.rs` calls `auth::seam::store_session_online(&state.store, …)`,
  `auth::resolve_access(&state, …)`, `state.store.clear_cached_session()` — every
  symbol exists with the signatures used. ✔
- Scaffold symbols used by `commands.rs` (`builtin_scaffolds`,
  `request_from_choice`, `Scaffold`, `ScaffoldChoice`) all exist in
  `scaffold.rs`. ✔

### 2.2 `AuthError` → `AppError` conversion (flagged as a likely break point) — OK
`model.rs` defines `impl From<crate::auth::AuthError> for AppError` with a 1:1
re-tag of all eight variants (`NoCachedSession`, `JwksParseError`,
`SignatureInvalid`, `TokenExpired`, `MalformedToken`, `MissingJwks`,
`StorageError`, `NetworkError`). `AppError` carries matching variants with the
same names, and the serde attribute `#[serde(tag = "kind", content = "message",
rename_all = "camelCase")]` means the IPC `kind` equals the originating variant
name — **Req 8.2 satisfied**. `commands.rs` uses `.map_err(AppError::from)`,
which resolves to this impl. ✔ This integration point is sound.

### 2.3 Pinned-crate API shapes — OK (verified against Cargo.lock)
Resolved versions from `Cargo.lock`: `jsonwebtoken 9.3.1`, `rusqlite 0.32.1`
(`libsqlite3-sys 0.30.1`, bundled), `base64 0.22.1`, `rsa 0.9.10` (with
`pkcs1 0.7.5`), `rand 0.8.8`, `proptest 1.11.0`, `reqwest 0.12.28`.

- **rusqlite 0.32**: `Connection::open`/`open_in_memory`, `execute_batch`,
  `execute` with `params![…]`, `query_row`, and `.optional()` from
  `OptionalExtension` — all present in 0.32 and imported correctly
  (`use rusqlite::{params, Connection, OptionalExtension};`). ✔
- **jsonwebtoken 9**: `decode`, `decode_header`, `Validation::new`,
  `DecodingKey::from_rsa_components(&n,&e)`, `from_ec_components(&x,&y)`,
  `jwk::{JwkSet, AlgorithmParameters, KeyAlgorithm}`, `JwkSet::find`,
  `Header{kid}`, `Algorithm::RS256`, `validation.validate_exp/validate_aud`,
  `errors::ErrorKind::{InvalidToken, Base64, Json}` — all match the v9 API. ✔
  The `jwk` module requires jsonwebtoken's `use_pem` default features, which are
  on (no `default-features = false` in Cargo.toml). ✔
- **base64 0.22**: `base64::engine::general_purpose::URL_SAFE_NO_PAD` + the
  `Engine` trait in scope via `use base64::Engine;` for `.encode`/`.decode`. ✔
- **rsa 0.9 + rand 0.8** (e2e test): `RsaPrivateKey::new(&mut rng, 2048)`,
  `to_public_key`, `pkcs1::EncodeRsaPrivateKey::to_pkcs1_der`,
  `traits::PublicKeyParts::{n,e}`, `rand::thread_rng()` — all correct for the
  resolved versions. `EncodingKey::from_rsa_der(der.as_bytes())` is valid in
  jsonwebtoken 9. ✔ Note `rand 0.8` is the dev-dep in use; `rand 0.9`/`0.10` also
  resolve in the tree for other crates but the test’s `thread_rng()` + `0.8` API
  is what the e2e module compiles against. ✔

### 2.4 Tauri v2 command signatures — OK
- `State<'_, AuthState>` is used in all three commands. `AuthState` holds a
  `SessionStore` (its `Connection` behind `std::sync::Mutex`) and a
  `Box<dyn OnlineGate + Send + Sync>`, so the managed state is `Send + Sync` as
  Tauri requires. ✔
- Return types: `auth_online_login`/`auth_logout` return
  `Result<_, AppError>` (AppError derives `Serialize`); `auth_resolve_role`
  returns `AuthContext` directly (infallible, `Serialize`). ✔ All three are
  registered in `invoke_handler!` in `lib.rs`. ✔

### 2.5 Features / derives — OK
- `rusqlite` has `features = ["bundled"]` → no system libsqlite3 needed. ✔
- `reqwest` has `blocking` + `rustls-tls` → `reqwest::blocking::Client` in
  `gate.rs`/`seam.rs` compiles with no system TLS. ✔
- Serde derives present where (de)serialized: `AuthContext`, `AuthSource`, `Role`
  (`Serialize`); `RawClaims` (`Deserialize`); `Claims` in the e2e test
  (`Serialize`). `CachedSession` needs no serde (hand-mapped to SQLite rows). ✔

### 2.6 Trait objects / borrows / lifetimes — OK
- `select_key<'a>(&'a JwkSet, Option<&str>) -> Option<&'a Jwk>` lifetime is
  correct. ✔
- `verify_jwt` clones nothing it shouldn't; `store_session_online` clones
  `claims.sub`/`claims.email` before moving `claims.role` into the `AuthContext`
  — no move-after-use. ✔

**No compile blockers found in the reviewed source.** The only unverified-by-
compiler surface is the post-build `lib.rs` setup closure (§1).

---

## 3. `lib.rs` setup closure (the one post-build edit) — reviewed, looks correct

```rust
.setup(|app| {
    use tauri::Manager;
    let db_path = app.path().app_data_dir()
        .map(|dir| { let _ = std::fs::create_dir_all(&dir); dir.join("session_cache.sqlite3") })
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "session_cache.sqlite3".to_string());
    let recheck_url = std::env::var("SUPABASE_ROLE_RECHECK_URL").unwrap_or_default();
    let gate: Box<dyn auth::gate::OnlineGate + Send + Sync> =
        Box::new(auth::gate::SupabaseGate::new(recheck_url));
    match auth::session_store::SessionStore::open(&db_path) {
        Ok(store) => { if let Err(e) = store.confirm_app_data_tables() { eprintln!(...); }
                       app.manage(auth::AuthState::new(store, gate)); }
        Err(e) => { eprintln!(...); }
    }
    Ok(())
})
```

- `app.path()` requires `use tauri::Manager;` — present inside the closure. ✔
- `app_data_dir()` in Tauri v2 returns `Result<PathBuf, _>`; `.map(...).map(...)
  .unwrap_or_else(|_| …)` treats it as a `Result`, which matches v2. ✔ (If the
  dev is on an older/newer tauri where this returns `Option`, the `unwrap_or_else`
  closure arg type would mismatch — low risk, but the first thing to check if
  `lib.rs` fails to build.)
- `SupabaseGate::new(impl Into<String>)` accepts the `String` from
  `unwrap_or_default()`. ✔
- The `Box<dyn OnlineGate + Send + Sync>` type annotation matches
  `AuthState::new`’s second parameter exactly. ✔
- `confirm_app_data_tables` is `pub` and returns `Result<(), AuthError>`. ✔

I found no error here, but because it is the only code the prior compile did not
cover, it is listed as the top thing to watch (non-blocking, pending compile).

---

## 4. Spec fidelity

### 4.1 Correctness properties P1–P6

| Property | Status | Evidence |
| --- | --- | --- |
| **P1 No trust without proof** | MET | `resolve_access` only returns `OfflineVerified` from `verify_cached_role` → `verify_jwt`, which reads the role from the decoded token (`Role::from_claim(&claims.role)`), never from `session.role`. `OnlineVerified` likewise only from `store_session_online` after `verify_jwt` Ok. |
| **P2 Fail toward more verification** | MET | On verify `Err`, `resolve_access` falls to `gate.recheck`; gate `Confirmed`→`OnlineGate`, else floor `StudentReadOnly`. No branch returns the loose role. proptest `p2_verify_failure_falls_to_gate_or_floor` asserts source ∈ {OnlineGate, StudentReadOnly}. |
| **P3 Offline floor is read-only** | MET | Final arm returns `role: Student, read_only: true, source: StudentReadOnly`. |
| **P4 Never fail open** | MET | Loose `session.role` is read nowhere in a decision path. The gate branch uses `role` from `GateOutcome::Confirmed`, not the column. proptest `p1_p4_loose_role_never_grants_access` over arbitrary loose roles. |
| **P5 Write-after-verify** | MET | `store_cached_session` is called in exactly one place — inside `store_session_online`, after `verify::verify_jwt(...)?` returns Ok. No other caller writes rows (session_store tests write directly, but that is test-only). |
| **P6 Removable layer** | MET | With garbage tokens (Layer 2 always fails), offline resolution yields Student read-only — the gate alone is a complete floor. proptest `p6_layer2_removed_offline_is_student_read_only`. |

### 4.2 Requirement-by-requirement coverage

| Req | Status | Notes |
| --- | --- | --- |
| 1.1/1.2 schema + role CHECK | MET | `migrate()` creates `cached_session` with the exact 7 columns and `check (role in ('student','teacher','admin'))`. |
| 1.3 invalid role rejected, prior row kept | MET | Single-statement upsert is atomic; a bad role hits the CHECK and surfaces `StorageError`; prior row untouched (test `invalid_role_rejected_and_prior_row_unchanged`). |
| 1.4 single row per user (upsert) | MET | `user_id` PK + `on conflict(user_id) do update`. |
| 1.5/1.6 confirm app-data tables, name each missing | MET | `confirm_app_data_tables` probes `modules/attempts/scores/drafts`, collects all missing, returns a `StorageError` naming each; modifies no schema. |
| 1.7–1.10 cache-not-authority, raw load, None on missing | MET | `load_cached_session` returns raw values via `.optional()` → `Ok(None)` when absent. |
| 2.1–2.6 seam write-after-verify | MET | `store_session_online`: `validate_token_contract` → `fetch_jwks` (NetworkError on failure, nothing written) → `verify_jwt` → `store_cached_session`. Nothing written on any failure. |
| 3.1–3.5 offline verify + OfflineVerified | MET | `verify_cached_role` + `resolve_access`; `read_only=false` on OfflineVerified. |
| 3.2 kid selection | MET | `select_key` matches `header.kid` via `JwkSet::find`; single-key fallback when kid absent/unmatched. |
| 3.6 fixed failure-cause order | MET (see §5 note) | `verify_jwt` checks empty-jwks→`MissingJwks`, parse→`JwksParseError`, empty keys→`MissingJwks`, header→`MalformedToken`, no-key→`SignatureInvalid`, decode→`Malformed`/`SignatureInvalid`, then own `exp`→`TokenExpired`. `NoCachedSession` handled one level up in `verify_cached_role`. Order matches the spec ladder. |
| 3.7–3.12 typed causes | MET | Each cause maps to its variant as specified. |
| 3.13 no loose-role AuthContext on failure | MET | See P2/P4. |
| 4.1–4.7 leak-prevention | MET | No decision branches on the loose column; verify-fail denies and falls to gate; gate-unreachable → Student read-only. |
| 5.1–5.7 modular build order | MET | `gate.rs` is crypto-free; `resolve_access` works with `verify` effectively removed (P6). |
| 6.1–6.6 grace fallback strictly descending | MET | OfflineVerified ≥ OnlineGate ≥ StudentReadOnly in one place; default is StudentReadOnly. |
| 7.1–7.2 claim contract | MET | `validate_token_contract` requires `sub,email,role,exp`; role ∈ {student,teacher,admin}; `exp` must be an integer. |
| 7.3 JWKS URL | MET (lenient) | Accepts any URL string; does not assert the `/auth/v1/.well-known/jwks.json` suffix (see §6 non-blocking). |
| 8.1–8.6 typed errors, no secrets, no panic | MET | See §7 security. |

No requirement appears unmet. Two are met *leniently* (3.6 empty-set→MissingJwks
interpretation; 7.3 URL not path-validated) — both documented in-code and
defensible; flagged as non-blocking.

---

## 5. Test soundness

- **session_store tests** (6): use `open_in_memory`, exercise upsert/no-dup,
  invalid-role rejection, raw load, clear, missing-table naming, all-present OK.
  Fields/methods referenced all exist. Should pass. ✔
- **verify tests** (5): empty/whitespace jwks→MissingJwks, bad json→JwksParseError,
  valid-but-empty keys→MissingJwks, malformed token→MalformedToken, key selection.
  Uses a real public-only RSA JWK literal — only exercises parse/selection, not a
  positive signature (correctly deferred to e2e). Consistent with code. ✔
- **gate tests** (3): pure `parse_recheck_role` — bare string, JSON `role` field,
  garbage rejection. No network. ✔
- **seam tests** (4): `validate_token_contract` over hand-built unsigned tokens
  (base64url payload). No network. ✔
- **orchestrator_tests** (4) + **property_tests** (3): use a `ScriptGate` test
  double implementing `OnlineGate`; drive every resolver branch; no network. The
  proptest strategies generate only valid DB role strings, which is the right
  domain (the CHECK constraint bounds the column). ✔
- **e2e** (4): mints a real 2048-bit RSA key, builds a JWKS whose `n`/`e` are
  base64url of `public.n()/e().to_bytes_be()`, signs an RS256 token with
  `kid="e2e-key"`, caches it, and resolves. The JWKS JSON shape
  (`kty/use/kid/alg/n/e`) is exactly what `verify.rs` parses via
  `jsonwebtoken::jwk::JwkSet` + `AlgorithmParameters::RSA`. The `kid` in the
  header matches the JWKS entry, so `select_key` finds it and
  `from_rsa_components` builds the key. The round trip (sign→cache→verify) should
  succeed. ✔

**Runtime caveats for the dev:** the e2e tests generate RSA 2048 keys four times
(one per `mint` call) and run proptest cases — the test run is **CPU-heavier and
slower** than the existing offline-scoring tests. No test needs network (the
offline path has none; `fetch_jwks`/`SupabaseGate` are never hit by tests). All
tests use in-memory SQLite via the bundled feature. There is **no evidence a test
binary was previously linked**, so this is the part most reliant on this review
rather than a prior run.

---

## 6. Non-blocking issues

1. **`lib.rs` setup closure is the only un-compiled edit** (§1, §3). Looks
   correct; verify first if the build fails. The `app_data_dir()`
   Result-vs-Option shape is the specific risk if the local tauri patch version
   differs.
2. **Req 7.3 — JWKS URL not path-validated.** `store_session_online` accepts any
   URL; it does not assert the Supabase `/auth/v1/.well-known/jwks.json` suffix.
   The spec says "accept a JWKS URL referencing" that endpoint — currently any
   reachable URL is accepted. Low security impact (the signature verify is the
   real gate), but a stricter check would match the letter of 7.3.
3. **Req 3.6 empty-key-set → `MissingJwks`.** A syntactically valid `{"keys":[]}`
   returns `MissingJwks`, not `JwksParseError`. Reasonable and documented, but
   note it as an intentional interpretation during review.
4. **`select_key` single-key fallback on unmatched `kid`.** When a `kid` is given
   but unmatched and there is exactly one key, the code falls back to that key.
   Harmless (signature still must verify), but slightly more permissive than a
   strict `kid` match; worth a comment-level awareness.
5. **`cached_at desc limit 1` load.** `load_cached_session` ignores `user_id` and
   loads the most-recent row. Fine for the single-user device assumption stated
   in the design, but it means a multi-user device would silently resolve the
   latest login only.

None of these block compilation or violate a security property.

---

## 7. Security review (Req 8.4 / 8.5 / 4.4)

- **No secret material in errors or logs.** Grepped the auth tree: no `AuthError`
  message interpolates `access_token`, `jwks_cache`, or decoded claim values.
  Messages carry only static descriptions or the underlying crate error `{e}`
  (e.g. "token header did not decode: {e}"), none of which echo the token or
  keys. `device_now`, `verify_jwt`, `store_session_online` log nothing. ✔
- **No token in log output.** The only `eprintln!`s are in `lib.rs` setup
  (table-provisioning / open-failure notes) and `commands.rs` `resolve_generation`
  (a "fell back" breadcrumb) — none touch the auth token. ✔
- **Req 4.4 — no decision branches on the loose role outside auth::verify /
  auth::gate.** Grepped `loader.rs`, `scoring.rs`, `module_store.rs`,
  `normalize.rs`, `salt.rs`, `seal.rs`, `scaffold.rs`, `groq.rs` for
  `role|auth|cached_session|access_token|jwks`. The only hits are unrelated: the
  Groq chat-message `"role"` field (`system`/`user`/`assistant`) in `groq.rs` and
  `scaffold.rs`, and a `salt`/`hash` comment in `scoring.rs`. **Zero auth/role
  authority references in the core modules.** ✔
- **Req 8.6 — no panic across the boundary.** The command path returns typed
  errors; `verify_jwt` maps every failure to an `AuthError` and never `unwrap`s on
  external input. `device_now` uses `.unwrap_or(0)` (fails closed). The `unwrap`s
  in tests are test-only. ✔
- **DB file treated as sensitive.** The token is stored at rest in SQLite as the
  design intends; no additional at-rest encryption is specified by the spec, and
  none is claimed. ✔

No security blockers.

---

## 8. Blocking issues

**None found.** No issue in the reviewed source will break compilation or violate
a security property. The one item that is *unverified by compiler* (not known-bad)
is the post-build `lib.rs` setup edit — see §1/§3.

---

## 9. How the dev should verify (on a machine with cargo)

```sh
cd Syndes/src-tauri
cargo build          # confirms the whole crate, incl. the post-build lib.rs edit
cargo test           # runs auth unit + proptest + RSA-minting e2e
```

Expect `cargo test` to be **noticeably slower / more CPU-bound** than before: the
e2e module generates multiple RSA-2048 keypairs and proptest runs many cases. No
network is required for any test. If `cargo build` fails, check the `lib.rs`
`.setup` closure first (specifically `app_data_dir()`’s return shape against the
locally resolved tauri patch), as it is the only code the prior successful
compile (`target/debug/deps/syndes_lib-*`, 2026-10-04 02:41) did not cover.

---

## 10. Evidence appendix

- Prior successful compile of all auth files: `target/debug/deps/
  syndes_lib-2976046023da498f.d` and `-8193e8e0b2d709f1.d` (2026-10-04 02:41:38 /
  02:41:41) list `src\auth\{mod,gate,seam,session_store,verify}.rs` as inputs.
- Source mtimes: all auth files 02:17–02:26; **`lib.rs` 02:42:10** (after the
  build).
- Resolved crate versions (`Cargo.lock`): jsonwebtoken 9.3.1, rusqlite 0.32.1 /
  libsqlite3-sys 0.30.1, base64 0.22.1, rsa 0.9.10, rand 0.8.8, proptest 1.11.0,
  reqwest 0.12.28, pkcs1 0.7.5.
- No `syndes*` test `.exe` present in `target/debug/deps/` → no evidence a test
  binary was ever linked (tests reviewed statically only).
