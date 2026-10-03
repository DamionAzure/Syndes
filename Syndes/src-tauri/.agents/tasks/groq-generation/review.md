# Groq teacher-lane module generation with guaranteed fallback

This change adds the spec 03 Teacher/Content Lane generation path to the Rust core: a new `groq.rs` that turns a teacher's topic into an in-memory draft module via Groq's OpenAI-compatible chat API, and a `generate_module` command that seals that draft through the existing core and — critically for the demo — never fails. The pure logic (prompt building, request shaping, response parsing, draft-shape validation) is cleanly separated from a single tiny network function, so everything except the live HTTP call is unit-tested offline. The API key is read from the environment only, the draft's plaintext answers flow straight into `seal_module` without ever being written or logged, and the generation lane is kept out of the student/offline scoring path. The one real caveat is that the build and tests were never run because no Rust toolchain exists on the machine.

Watch for:
- The whole suite is UNVERIFIED at runtime — no Rust toolchain present, so neither the new tests nor the existing ones were compiled or run, and `reqwest` was never fetched/built (confirmed, per verification note).
- Fallback-path dependency on current working directory: `FALLBACK_CANDIDATES` and the fixture resolution are relative paths, so the "guaranteed" fallback is only guaranteed when the process runs with CWD at the crate manifest dir (likely).

**Verdict**: APPROVED

## High-level view

The design splits a teacher-side online concern into pure, testable pieces and one network boundary. `build_system_prompt`/`build_user_prompt`/`build_request_body` shape the request, `parse_generation_response`/`validate_draft_shape` handle the response, and `call_groq` is the only function that touches the network. The orchestrator `generate_draft` wires them together behind an env-key check, which is why nearly everything except the live call is unit-tested offline.

The command layer adds the fallback guarantee. `generate_module` loads a pre-sealed fixture up front, attempts live generation plus seal, and on any error serves the fixture instead. The decision is factored into a pure `resolve_generation` that is unit-tested both ways. The design choice worth noting is that fixture load failure is the one thing that still surfaces as an error — the guarantee is "always serve a module if the fixture resolves," not "never return Err."

Security posture is sound for the stated scope: the key comes from env only with no hardcoded literal, the key never enters an error or log string, and the plaintext answers in the draft never leave memory before sealing. Isolation holds — nothing in the student/offline path references the generation module.

The gap is verification, not code. The toolchain is absent, so nothing was compiled or run and the new dependency was never resolved. The contract directs that this not be re-run here; it is called out as a known, honest blocker to be closed when a toolchain is available.

<details>
<summary>Issues (4)</summary>

1. **Unverified at runtime** — no Rust toolchain on the machine, so the new `groq`/`commands` tests, the existing suites, and the `reqwest` fetch/compile were never exercised. Must be run (`cargo build && cargo test` from `src-tauri/`) before shipping.
2. **Fallback resolution is CWD-relative** — `FALLBACK_CANDIDATES` uses `../../docs|Documents/...` relative paths, so the fallback guarantee holds only when the process CWD is the crate manifest dir. Fine for `cargo test`/`cargo tauri dev`; confirm the packaged app's CWD or resolve against the manifest dir explicitly.
3. **Fixture-missing path returns Err** — `generate_module` propagates an error if the fallback fixture itself cannot load, so the "never fails" guarantee is conditional on the fixture being present. Intended, but worth noting as the one failure mode left open.
4. **Env-key branch untested** — `generate_draft`'s missing/empty `GROQ_API_KEY` path and `call_groq` have no test coverage. Low risk given the code is simple, but the "missing key -> GenerationError, no panic" contract point rests on inspection only.

</details>

<details>
<summary>Details</summary>

### Transport split: pure logic around one network function

`call_groq` is the only function that opens a socket: it constructs a blocking `reqwest::Client`, POSTs with `bearer_auth`, reads the body text, and maps both transport errors and non-2xx status to `GenerationError`. Because the functions feeding and consuming it are pure, the offline tests cover request shaping, a valid Groq envelope, malformed inner JSON, missing content, and a draft whose MC answer is not among its options — without a live call. The gap in that coverage is `call_groq` itself and `generate_draft`'s env-key branch, neither of which is exercised (the live path and the env read have no test seam here).

```
generate_draft
  ├─ env GROQ_API_KEY (empty/missing -> GenerationError, no panic)
  ├─ build_request_body ── build_system_prompt + build_user_prompt
  ├─ call_groq  ◄── the only network touch
  ├─ parse_generation_response  (choices[0].message.content -> inner JSON -> DraftModule)
  └─ validate_draft_shape       (contract constants + per-kind option rules)
```

### Draft-shape validation mirrors the sealed contract

`validate_draft_shape` enforces the locked contract before the draft reaches the seal step: `schema_version == "1.0"`, non-empty id/title, non-empty per-question prompt and answer, known kinds only (`multiple_choice`, `identification`, `true_false`), MC/TF require ≥2 options with the answer among them, identification must carry no options, and `hash_algo`/`normalization` must equal the locked constants (`SHA-256`, `lowercase|trim|collapse-ws|strip-punct`). Attributing these failures to `GenerationError` rather than letting them fall through to a later `ValidationError` from the seal path makes a bad model response legible as a generation problem, which is the right call for the teacher lane. The constants are duplicated here from the loader's contract rather than shared, so if the locked contract ever changes, both sites must move together — a maintenance coupling worth noting but not a defect.

### Guaranteed fallback and the one open failure mode

`generate_module` loads the pre-sealed fixture first, then runs `generate_draft` + `seal_module`, and routes the result through `resolve_generation`: `Ok` passes through, any `Err` logs a brief breadcrumb and returns the fixture. Pulling the decision into a pure function is what makes it unit-testable, and the tests cover both branches plus confirming the fixture loads as `mod_science_photosynthesis_01`.

The nuance: the fixture is loaded with `?`, so if neither candidate path resolves, `generate_module` returns `Err` rather than serving anything. That is a deliberate "if even the fallback is missing, that's a real setup error" stance, and it is reasonable — but it means the "never fails" guarantee is really "never fails as long as the fixture is present." Combined with the fact that `FALLBACK_CANDIDATES` are relative paths (`../../docs/...`, `../../Documents/...`), the guarantee is also implicitly tied to the process running with CWD at the crate manifest dir. This matches the existing e2e test's approach in `lib.rs`, so it is consistent with the codebase, and under `cargo test` / `cargo tauri dev` the CWD is correct. The thing to confirm before relying on this in a packaged build is whether the shipped app runs with the same CWD; if not, resolving against `CARGO_MANIFEST_DIR` or a bundled resource path would make the guarantee hold unconditionally.

### Secret handling and plaintext discipline

The key is read via `std::env::var("GROQ_API_KEY")`, filtered for empty, and a missing/empty key yields `GenerationError("GROQ_API_KEY not set")` with no panic — confirmed, and a grep across the source turned up no hardcoded key literal (`gsk_`/`sk-`) anywhere, only the env read. The key is passed to `bearer_auth` and never interpolated into an error string; `call_groq`'s error messages carry only the reqwest Display (which omits the auth header) and the numeric status code. On the plaintext side, the generated draft carries answers in the clear but flows directly into `seal::seal_module` and is never written to disk or logged; the single `eprintln!` in `resolve_generation` logs only the typed error Display, which contains neither the answer nor the key. The parse step is explicit about not echoing the model content (which holds plaintext answers) into its error. This is the governing invariant and it holds.

### Isolation from the student/offline path

A grep for `groq` across `loader.rs`, `scoring.rs`, and `module_store.rs` returns nothing — confirmed independently. The generation module is reachable only from `commands::generate_module` and is declared in `lib.rs` with a comment making the isolation intent explicit. The offline scoring path cannot reach the network lane.

### Dependency and runtime shape

`reqwest` is added pinned to `=0.12.28` with `default-features = false` and features `["json", "rustls-tls", "blocking"]`, which keeps the build off system OpenSSL/native-tls and uses the blocking client so the command stays synchronous without pulling a tokio runtime into the boundary. The exact pin and feature set match the contract. This has not been compiled, so transitive resolution and the no-tokio claim are unverified in practice (see below).

### Verification gap

The verification note documents that no Rust toolchain is present (`cargo`, `rustc`, `rustup` all missing; no `.cargo`/`.rustup`; a recursive scan found no `cargo.exe`), so `cargo build` and `cargo test` were not run and no tests are claimed to pass. The first cargo invocation would also need to fetch `reqwest 0.12.28` and its transitive crates from crates.io. The static safety checks (isolation, no key literal, no plaintext-answer logging) were run and I re-confirmed the first two here. The code reads as correct against the contract on every structural point, but runtime verification remains outstanding and must be completed on a machine with a toolchain before this ships.

</details>

<details>
<summary>Files changed</summary>

- `src-tauri/src/groq.rs` (new) — teacher-side online Groq client: request/response pure functions, `validate_draft_shape`, single `call_groq`, `generate_draft` orchestrator, offline unit tests.
- `src-tauri/src/commands.rs` — `generate_module` command, `load_fallback_module`, pure `resolve_generation`, fallback tests.
- `src-tauri/src/lib.rs` — `mod groq;` plus `generate_module` registered in the invoke handler.
- `src-tauri/src/model.rs` — `AppError::GenerationError(String)` added to the enum and its Display; existing variants untouched.
- `src-tauri/Cargo.toml` — `reqwest = "=0.12.28"` with `default-features=false`, features `["json","rustls-tls","blocking"]`.

Full diff: `git diff main` from the repo root (`feat/groq-generation`).

</details>
