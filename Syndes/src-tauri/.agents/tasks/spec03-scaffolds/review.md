# Deterministic prompting scaffolds for the teacher/content lane

Spec-03's "SHOULD" task adds a fixed catalog of structured starting points so a non-techy teacher never faces a blank prompt box. A new `scaffold.rs` ships a pure, offline builder (`request_from_choice`) that turns a teacher's pick plus optional overrides into a `groq::GenerationRequest`, and `commands.rs` exposes `list_scaffolds` / `generate_from_scaffold`. The scaffold path reuses the existing `GenerationRequest` rather than forking it, and runs through the same live-generate → seal → guaranteed-fallback logic that was factored into a single shared helper (`generate_module_from_request`). This is a by-hand static correctness review only — no Rust toolchain on this machine, nothing was compiled or run.

Watch for: the fallback fixture resolves only at `docs/example.module.json` on this branch (the `Documents/` candidate does not exist), so the three `commands.rs` fallback tests and the `lib.rs` e2e tests depend on that file being present at the workspace root (confirmed). `generate_from_scaffold` and `generate_module` share one fallback helper, so the no-plaintext/seal contract cannot be bypassed by the scaffold path. No API key literal in source, no plaintext-answer logging, and no `groq`/`scaffold` reach from the student path (confirmed by grep).

**Verdict**: APPROVED

## High-level view

Compilation looks sound. Every `use` in `scaffold.rs` resolves (`crate::groq::GenerationRequest`, `crate::model::AppError`, serde derives), `mod scaffold;` is declared in `lib.rs`, and both new commands are registered in the `generate_handler!` invoke list with unique names. The builder constructs `GenerationRequest` with all five of its `pub` fields and no extras, so the struct literal is complete.

The command surface is well-formed for Tauri: `list_scaffolds() -> Vec<Scaffold>` returns a `Serialize` type, and `generate_from_scaffold(choice: ScaffoldChoice) -> Result<Module, AppError>` takes a `Deserialize` param and returns a `Serialize` ok plus a `Serialize` error. camelCase renames are present on both `Scaffold` (serialized to JS) and `ScaffoldChoice` (deserialized from JS).

The fallback guarantee is single-sourced. `generate_module_from_request` holds the one copy of the live-generate → seal → fall-back-on-any-error logic; both `generate_module` and `generate_from_scaffold` call it, so the guarantee cannot drift. Scaffold-produced requests go through `groq::generate_draft` → `seal::seal_module` → `loader::validate`, so a scaffold cannot bypass the locked contract (no-plaintext, normalization parity).

Isolation holds. `scaffold.rs` is pure/offline (no I/O, no network, no randomness) and, like `groq.rs`, is not referenced by `loader.rs` / `scoring.rs` / `module_store.rs` — a grep for `groq|scaffold` across those three files returns nothing. No hardcoded API key (the only `gsk_` is `"gsk_example"` in a groq unit test), and the sole `eprintln!` logs the typed `AppError` only.

The tests are self-consistent and reference only real fields/functions. The one dependency worth flagging is the fallback fixture file, which exists at `docs/` but not `Documents/` on this branch.

<details>
<summary>Issues (3)</summary>

1. **Fallback fixture is a test dependency** — the three `commands.rs` fallback tests and the four `lib.rs` e2e tests load `example.module.json`; it exists at `docs/` (not `Documents/`) on this branch. If a dev checks out a branch lacking it, those tests fail with a clear "fixture not found" message, not a compile error. No action needed on this branch; note it for the dev running `cargo test`.
2. **`override_or` has a redundant lifetime** — `fn override_or<'a>(over: &'a Option<String>, preset: &'a str) -> String` ties two input lifetimes together though it returns an owned `String`. Harmless (compiles, no borrow tie on the output), but the `'a` can be dropped for clarity.
3. **Subject is intentionally not overridable** — teachers cannot change the subject once a scaffold is picked. This is by design (keeps the lane consistent) and documented, not a bug; flagged only so the UI lane knows the field is fixed.

</details>

<details>
<summary>Details</summary>

### Compilation plausibility

Every `use` in `scaffold.rs` resolves against the crate: `crate::groq::GenerationRequest` (a `pub struct` in `groq.rs`), `crate::model::AppError` (a `pub enum` in `model.rs`), and `serde::{Deserialize, Serialize}` (serde is a dependency with `derive`). `mod scaffold;` is present in `lib.rs` alongside the other modules, so the module is in the crate graph.

The builder's struct literal is complete and type-correct:

```rust
Ok(GenerationRequest {
    topic,                              // String
    subject: Some(scaffold.subject),    // Option<String>
    grade_level: Some(grade_level),     // Option<String>
    source_text: None,                  // Option<String>
    num_questions: Some(num_questions), // Option<u32>
})
```

`GenerationRequest` in `groq.rs` declares exactly these five `pub` fields (`topic: String`, `subject/grade_level/source_text: Option<String>`, `num_questions: Option<u32>`). Every field is covered, none is extra, and all are `pub` and in the same crate, so the literal is legal from `scaffold.rs`.

Move/borrow check on `request_from_choice`: `builtin_scaffolds().into_iter().find(...)` yields an owned `Scaffold`. `topic` and `grade_level` are computed via `override_or(&choice.topic, &scaffold.topic_hint)` / `&scaffold.grade_level` — immutable borrows that end before the struct literal. `scaffold.subject` is then moved into the literal; this is the last use of `scaffold`, so there is no move-while-borrowed conflict. `num_questions` reads `choice.num_questions` (a `Copy` `Option<u32>`). Clean.

`clamp_question_count` uses `u32::clamp` (stable since 1.50) with `MIN_QUESTIONS=1`, `MAX_QUESTIONS=20`; `MIN <= MAX`, so `clamp` will not panic. `(MIN_QUESTIONS..=MAX_QUESTIONS).contains(&n)` in the well-formed test is a `RangeInclusive<u32>` check — fine.

The serde posture matches the direction of travel. `Scaffold` derives `Serialize` + `#[serde(rename_all = "camelCase")]` because the whole catalog ships to JS via `list_scaffolds` (so `grade_level` → `gradeLevel`, `topic_hint` → `topicHint`, etc.). `ScaffoldChoice` derives `Deserialize` + camelCase because it arrives from `invoke("generate_from_scaffold", { choice })` (so JS sends `scaffoldId`, `gradeLevel`, `numQuestions`). This mirrors `GenerationRequest`'s camelCase deserialize contract in `groq.rs`.

### Command registration and the Tauri boundary

`lib.rs` registers both new commands in `tauri::generate_handler![ ... ]`:

```rust
commands::generate_module,
commands::list_scaffolds,
commands::generate_from_scaffold,
```

Names are unique against the existing set (`load_module`, `check_answer`, `score_submission`, `normalize_answer`, `seal_module`, `seal_answer`, `generate_module`). Both are annotated `#[tauri::command]` in `commands.rs`.

Signatures satisfy the command contract: `list_scaffolds() -> Vec<Scaffold>` returns a `Serialize` type (serializable because `Scaffold: Serialize`), and `generate_from_scaffold(choice: ScaffoldChoice) -> Result<Module, AppError>` takes a `Deserialize` parameter and returns `Result<Serialize, Serialize>` (`Module: Serialize`, `AppError: Serialize` with `#[serde(tag="kind", content="message")]`). `commands.rs` imports `use crate::scaffold::{self, Scaffold, ScaffoldChoice};` — `scaffold::` is used by `builtin_scaffolds()` / `request_from_choice`, `Scaffold` by the `list_scaffolds` return type, `ScaffoldChoice` by the `generate_from_scaffold` param, so no unused-import warnings.

### Shared fallback helper — no divergent duplicate

The fallback guarantee lives in exactly one place:

```rust
fn generate_module_from_request(request: GenerationRequest) -> Result<Module, AppError> {
    let fallback = load_fallback_module()?;
    let generated = groq::generate_draft(request).and_then(seal::seal_module);
    Ok(resolve_generation(generated, fallback))
}
```

`generate_module` is a thin wrapper over it, and `generate_from_scaffold` calls it after building the request. There is no second copy of the seal-or-fall-back logic, so the two commands cannot drift. `resolve_generation` is a pure `Result<Module> + Module -> Module` decision (Ok passes through, any Err yields the fallback), and it is unit-tested directly in both directions (`resolve_err_yields_fallback`, `resolve_ok_passes_through`). The fallback guarantee holds for BOTH entry points.

One deliberate asymmetry worth stating: if the fallback fixture itself cannot load, `generate_module_from_request` returns the `load_fallback_module` error (via `?`) rather than papering over it. That is the right call — a missing fixture is a genuine setup error, not something to hide — and it applies equally to both commands.

### Contract fidelity — scaffolds cannot bypass the lock

A scaffold-driven request takes the identical downstream path as a free-form one: `groq::generate_draft(request)` (which runs `parse_generation_response` + `validate_draft_shape`), then `seal::seal_module`, which calls `loader::validate` as its final gate. The locked contract strings (`hash_algo = "SHA-256"`, `normalization = "lowercase|trim|collapse-ws|strip-punct"`), the three allowed kinds, and the MC/TF-options rule are all enforced in both `validate_draft_shape` (groq.rs) and `loader::validate` (loader.rs). Sealing hashes through `scoring::seal`, the same normalizer+join `scoring::check` uses, so normalization parity (the #1 cross-lane bug) is preserved. The scaffold layer only shapes the *prompt inputs* (topic/subject/grade/count); it never touches hashing, sealing, or validation, so it cannot produce a plaintext-bearing or contract-violating module.

### Security and isolation

No API key is hardcoded: the key is read only via `std::env::var("GROQ_API_KEY")` in `groq::generate_draft`, and the only `gsk_` literal in the tree is `"gsk_example"` inside a `groq.rs` unit test for `require_api_key`. No plaintext answer is logged anywhere on the scaffold path — `scaffold.rs` has no logging and no I/O, and the single `eprintln!` (in `resolve_generation`) interpolates only the typed `AppError`, whose `Display` never carries an answer or key.

A grep for `groq|scaffold` across `loader.rs`, `scoring.rs`, and `module_store.rs` returns no matches, so neither teacher-side module is reachable from the scoring path. `scaffold.rs` is pure and deterministic (no network, no I/O, no randomness), which the catalog-determinism tests exercise directly.

### Tests — self-consistent, one external dependency

The 10 `scaffold.rs` tests reference only real fields and functions: `builtin_scaffolds`, `request_from_choice`, `ScaffoldChoice`, `GenerationRequest.{topic,subject,grade_level,num_questions,source_text}`, `MIN_QUESTIONS`/`MAX_QUESTIONS`, and `build_request_body`. Assertions match actual behavior: id-only uses presets; non-blank overrides win; whitespace-only overrides fall back (consistent with `override_or`'s `.trim().is_empty()` check); subject is never overridden; unknown id → `ValidationError`; clamp pins to 1 and 20 at the edges; and the produced request is accepted by `build_request_body` with the resolved topic (`"Parts of a plant and their functions"`) carried in the user message (`build_user_prompt` emits `Topic: {topic}`). All offline.

The one dependency to flag: the `commands.rs` fallback tests (`fallback_loads_known_good_fixture`, `resolve_err_yields_fallback`, `resolve_ok_passes_through`) and the `lib.rs` e2e tests load `example.module.json`. It is resolved relative to `CARGO_MANIFEST_DIR` across `docs/` and `Documents/` candidates. On this branch the file exists at `docs/example.module.json` (id `mod_science_photosynthesis_01`, 3 questions: MC/identification/true_false) and NOT at `Documents/`, which matches every assertion. If a dev runs `cargo test` on a branch missing the fixture, those tests fail with an explicit "fixture not found" / "fallback … not found" message rather than a confusing compile or panic. This is a known, documented runtime dependency, not a correctness defect in the scaffold code.

### Residual risks for the dev with cargo installed

- The fixture must be present at the workspace root (`docs/example.module.json` on this branch). Without it, 3 fallback + 4 e2e tests fail by design; the scaffold unit tests still pass (they do no I/O).
- No live Groq call is exercised by the suite (by design — `call_groq` is the only network function and is not unit-tested). `generate_from_scaffold` end-to-end against the real API is only verifiable on a machine with a valid `GROQ_API_KEY`; without it the command falls back, which is the intended behavior.
- `override_or`'s `<'a>` lifetime is redundant (returns owned `String`); cosmetic only.
- `num_questions` clamp uses `u32::clamp(1, 20)` — fine, bounds ordered correctly, no panic.

</details>

<details>
<summary>File map</summary>

- `src/scaffold.rs` (new) — `Scaffold`/`ScaffoldChoice` types, `builtin_scaffolds()` catalog (5 entries), pure `request_from_choice` builder, 10 offline unit tests.
- `src/commands.rs` — new `generate_module_from_request` shared helper; `generate_module` reduced to a wrapper; new `list_scaffolds` + `generate_from_scaffold` commands; 3 fallback tests.
- `src/lib.rs` — `mod scaffold;` added; `list_scaffolds` + `generate_from_scaffold` registered in the invoke handler.
- `src/groq.rs`, `src/seal.rs`, `src/model.rs`, `src/loader.rs`, `src/scoring.rs`, `src/salt.rs`, `src/normalize.rs`, `src/module_store.rs` — unchanged; read for signature/contract verification.
- `Cargo.toml` — reqwest `=0.12.28` with `json`+`rustls-tls`+`blocking`; `getrandom = "0.3"` (matches `getrandom::fill` API in salt.rs); serde `derive`.
- `docs/example.module.json` — fallback fixture + shared test fixture (present; `Documents/` variant absent on this branch).

Review inputs: the spec-03 lane source under `src-tauri/src`, `Cargo.toml`, `docs/03-teacher-content-lane.md`, `docs/00-module-contract.md`, and the coder's `verification.md`.

</details>
