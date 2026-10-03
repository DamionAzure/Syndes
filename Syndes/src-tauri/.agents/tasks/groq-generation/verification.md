# Verification — spec 03 Groq generation (T2) + guaranteed fallback (T4)

Branch: `feat/groq-generation`
Scope: Rust core only (`src-tauri/`). First iteration (no prior `review.json`).

## What changed

- `src-tauri/src/model.rs` — added `AppError::GenerationError(String)` variant + its `Display` arm. No existing variants removed or renamed.
- `src-tauri/Cargo.toml` — added `reqwest = { version = "=0.12.28", default-features = false, features = ["json", "rustls-tls", "blocking"] }` (exact pin, blocking client, rustls, no native-tls).
- `src-tauri/src/groq.rs` — NEW. Teacher-side, online-only Groq client:
  - `GenerationRequest` (Deserialize, camelCase).
  - Pure/testable: `build_system_prompt`, `build_request_body`, `parse_generation_response`, `validate_draft_shape`.
  - Single network fn `call_groq` (blocking reqwest; maps network/non-2xx to `GenerationError`; never includes the key).
  - Orchestrator `generate_draft` (env key check -> body -> call -> parse -> validate).
  - `const GROQ_MODEL = "openai/gpt-oss-120b"` in one place.
  - Unit tests (offline): request body has model/json_object/system+user messages; parse of a hardcoded valid Groq response yields the expected `DraftModule`; malformed inner JSON and missing content return `GenerationError`; `validate_draft_shape` accepts a good draft and rejects an MC answer not among options.
- `src-tauri/src/commands.rs` — NEW `generate_module(request)` command (teacher-side), `load_fallback_module()` (resolves `docs/` or `Documents/` fixture via a CANDIDATES array, loads through `loader::load_module`), and pure `resolve_generation(result, fallback)` for the fallback decision. Tests: fallback loads the known-good fixture (`mod_science_photosynthesis_01`); `Err` -> fallback; `Ok` -> pass-through.
- `src-tauri/src/lib.rs` — added `mod groq;` and registered `commands::generate_module` in the invoke handler.

Pipeline on the happy path: `groq::generate_draft(request)` -> `seal::seal_module(draft)` (plaintext dropped, validated). On ANY generation error the command logs a brief non-sensitive note and returns the fallback module — the live call is a bonus, never a dependency (spec 03 R4/R5).

## Build / test status — BLOCKED (toolchain not installed)

The build and tests could NOT be run because no Rust toolchain is present on this machine. This was checked, not assumed:

- `cargo --version` → `'cargo' is not recognized ...`
- `Get-Command cargo | rustc | rustup` → all MISSING
- Default install path `%USERPROFILE%\.cargo\bin\cargo.exe` → does not exist
- `%USERPROFILE%\.rustup`, `C:\Program Files\Rust*`, `%LOCALAPPDATA%\Programs\Rust*` → none exist
- Recursive scan of `C:\` for `cargo.exe` (depth 5) → nothing found
- `cmd /c "cargo test"` from `src-tauri/` → exit 1, `'cargo' is not recognized as an internal or external command`

Because the toolchain is absent I did NOT run `cargo test` or `cargo build`, and I am NOT claiming any tests passed. Adding `reqwest` also requires a crates.io download + compile of transitive deps, which likewise cannot be exercised here.

### To verify once a toolchain is available
From `src-tauri/`:

```
cargo build
cargo test
```

Expected: all existing suites (scoring, normalize, loader, seal, salt, e2e) plus the new `groq` unit tests and `commands` fallback tests compile and pass. The first `cargo` run will fetch `reqwest 0.12.28` and its transitive crates from crates.io; if the network blocks downloads, that must be reported rather than worked around.

## Static safety checks (ran successfully)

- Student-path isolation: grep for `groq` in `loader.rs`, `scoring.rs`, `module_store.rs` → no matches. Groq is not reachable from the offline student path (spec 03 R5).
- No API-key literal: the only `GROQ_API_KEY` reference is `std::env::var("GROQ_API_KEY")` in `groq.rs::generate_draft`. No hardcoded key, no `gsk_`/`sk-` literals.
- No plaintext-answer logging: grep for `(println|eprintln|print|dbg).*answer` → no matches. The one `eprintln!` in `commands.rs` logs only the typed error Display (no answer, no key).

## Cleanup

Temporary files created during investigation were removed. No draft/plaintext data was written to disk at any point.

---

## UPDATE — runtime verification completed + review findings addressed

A Rust toolchain was available on the integrating machine, so the blocked steps were run and the semantic review's findings (`review.md`, verdict APPROVED, all non-blocking) were acted on.

- **Finding #1 (unverified at runtime) — RESOLVED.** `cargo build` succeeds, including the first-time fetch + compile of `reqwest 0.12.28` and its rustls transitive deps. `cargo test` passes (35 tests: scoring, normalize, loader, seal, salt, e2e, groq, commands). `cargo clippy --all-targets` is clean. Static safety checks re-confirmed independently: no hardcoded key (only `std::env::var`), and zero `groq` references in `loader.rs`/`scoring.rs`/`module_store.rs` (student-path isolation holds).
- **Finding #2 (CWD-relative fallback) — FIXED.** `load_fallback_module` now anchors the fixture lookup to `CARGO_MANIFEST_DIR` (`../..` to the outer workspace root) instead of CWD-relative paths, so the fallback guarantee holds no matter where the app is launched from, not just when CWD is `src-tauri/`.
- **Finding #3 (fixture-missing returns Err) — LEFT AS DESIGNED.** Deliberate "if even the fallback is missing, that's a real setup error" stance; reasonable and unchanged.
- **Finding #4 (env-key branch untested) — FIXED.** Extracted the key check into a pure `require_api_key(Option<String>)` and added tests for missing/empty/blank (→ `GenerationError`, no panic) and a valid key, without mutating process-global env vars.

### Additional gap found and closed (not in the original review)

The branch read `GROQ_API_KEY` from the environment but nothing loaded `.env`, so the key never reached `generate_draft` and `generate_module` would always fall back. Added `dotenvy` and a `dotenvy::dotenv()` call at startup in `run()` (absence is non-fatal; the offline path is untouched). Confirmed the key loads via a presence-only check (value never printed). `.env` is gitignored (`.env`, `.env.*`) with a committed `.env.example`; the real key has never been tracked or committed.

Not done here: no LIVE Groq API call was made (it would spend credits and hit an external service). The live smoke test — launch the app with a valid key in `.env` and trigger `generate_module` — remains for the team to run.
