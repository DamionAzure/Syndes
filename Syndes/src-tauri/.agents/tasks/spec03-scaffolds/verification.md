# Verification note — spec 03 scaffolds (prompting templates)

Status: **UNVERIFIED AT RUNTIME.** No Rust toolchain is installed on the authoring
machine, so this code was NOT compiled or test-run here. It was reviewed by hand
against the existing source it reuses (`groq.rs`, `seal.rs`, `commands.rs`,
`model.rs`, `lib.rs`). Compile + test it on a device with `cargo` installed.

## Commands the other dev should run

Absolute path (Windows):

```
cd c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\src-tauri
cargo build
cargo test
```

Relative form (from the workspace root):

```
cd Syndes/src-tauri
cargo build
cargo test
```

`cargo test` runs the full suite, including the 10 new `scaffold.rs` unit tests
and the existing `groq.rs` / `commands.rs` / `lib.rs` e2e tests.

## What was added

- **New file** `src/scaffold.rs` (teacher-side, pure/offline, deterministic):
  - `Scaffold` struct (`Debug, Clone, Serialize`, camelCase) — UI picker shape.
  - `ScaffoldChoice` struct (`Debug, Clone, Deserialize`, camelCase) — teacher pick + overrides.
  - `builtin_scaffolds() -> Vec<Scaffold>` — fixed, ordered catalog of 5 scaffolds
    (Science, Mathematics, English, Filipino, Araling Panlipunan), stable ids/order,
    original topic hints (no copyrighted DepEd text).
  - `request_from_choice(&ScaffoldChoice) -> Result<GenerationRequest, AppError>` —
    pure builder; reuses `groq::GenerationRequest` (not forked); overrides win over
    presets, blanks fall back, subject always from scaffold, count clamped to 1..=20;
    unknown id -> `AppError::ValidationError`.
  - 10 unit tests (all offline): non-empty catalog; unique + stable ids/order;
    well-formed scaffolds; id-only uses presets; overrides win; blank overrides fall
    back; unknown id = ValidationError; clamp at both bounds; produced request accepted
    by `groq::build_request_body` with the resolved topic in the user message.
- **`src/commands.rs`**:
  - New internal helper `generate_module_from_request(request) -> Result<Module, AppError>`
    carrying the one copy of the live-generate -> seal -> guaranteed-fallback logic.
  - `generate_module` now a thin wrapper over that helper (behavior identical —
    same `load_fallback_module` + `resolve_generation`).
  - New command `list_scaffolds() -> Vec<Scaffold>`.
  - New command `generate_from_scaffold(choice: ScaffoldChoice) -> Result<Module, AppError>`
    — builds the request via `scaffold::request_from_choice` then runs the shared helper.
- **`src/lib.rs`**: `mod scaffold;` added; `list_scaffolds` + `generate_from_scaffold`
  registered in the `invoke_handler`.

## Fallback helper factoring

The fallback guarantee lives in exactly one place: `generate_module_from_request`.
Both `generate_module` and `generate_from_scaffold` call it, so the fallback logic
is not duplicated and cannot drift. `load_fallback_module` and `resolve_generation`
are unchanged.

## Isolation + no-secret checks (performed here)

- `grep` of `loader.rs` / `scoring.rs` / `module_store.rs` for `groq|scaffold`:
  **no matches** — the student/offline path cannot reach either teacher-side module.
- No API-key literal in source: the only `gsk_` hit is `"gsk_example"` inside a
  `groq.rs` unit test for the key-validation helper (not a real credential).
- No plaintext-answer logging: the sole `eprintln!` (in `commands.rs`
  `resolve_generation`) logs the typed `AppError` only — never an answer or key.
  `scaffold.rs` adds no logging and no I/O/network.

## By-hand compile sanity

- `scaffold.rs` constructs `groq::GenerationRequest` directly; all its fields are
  `pub` and in the same crate.
- `u32::clamp` (stable since Rust 1.50) used for the question-count bounds.
- Imports in `commands.rs` (`Scaffold`, `ScaffoldChoice`, `scaffold`) are all used
  by the new command signatures/bodies — no unused-import warnings expected.
