# Acassist — Kiro Specs Index

*Planning artifacts for the Saturday, Oct 3 2026 build (~12-hour single block). SPECS, not code — Kiro generates from these at the event, not before.*

These documents are the contract the four lanes build against. Read **00** and **01** together as a team first thing Saturday (the 0:00–0:45 scope-freeze block) — a mismatch there is invisible until the UI calls the Rust core and gets nothing.

## The files

| File | Lane / purpose | Owner |
|------|----------------|-------|
| `00-module-contract.md` | The shared JSON module contract — the interface **every** lane depends on | all (freeze at T0) |
| `01-tauri-command-boundary.md` | JS ↔ Rust command signatures (`load_module`, `check_answer`, `score_submission`, `normalize_answer`) | boundary (shared) |
| `02-ui-lane.md` | Quiz-take / lesson / result screens, vanilla JS in the webview | UI dev |
| `03-teacher-content-lane.md` | Groq generation + the seal step + the fallback module | exec lead |
| `04-rust-core.md` | Offline device-neutral scoring, module load, the authoritative normalizer | technical lead |
| `module.schema.json` | JSON Schema (Draft 2020-12) encoding `00` — validate modules programmatically | tooling |
| `example.module.json` | Hand-authored fixture + demo fallback + shared dev fixture | content lane |
| `tools/validate_module.py` | Dev script: validate a module against the schema | tooling |

## The one invariant that governs everything

**No plaintext answers, ever.** A shipped module carries `salt` + `answer_hash` only. The correct answer in the clear exists only on the teacher side at seal time. Everything else — device-neutral hashing, the single normalizer, the no-answer-field schema — exists to keep this true.

## How the schema wires in — three gates

1. **Content lane, at seal time** — validate before writing a module file; a failing module never ships. Cheapest place to catch errors.
2. **Rust core, at `load_module`** — rely on `serde` with `#[serde(deny_unknown_fields)]` for structural validation (no JSON-Schema crate at runtime — keeps the core lean). The standalone schema stays a dev + content-lane tool.
3. **Dev/CI** — `tools/validate_module.py` (or `npx ajv-cli`) run manually or in a pre-commit hook.

Validation checks **shape**, never hash **correctness**. Only the Rust core verifies a hash is the right hash, by recomputing. Two gates, both needed.

## Saturday reminder — the fixture's placeholder hashes

`example.module.json` ships with `PLACEHOLDER_` salts and hashes on purpose — real values depend on the real Rust normalizer, which doesn't exist until Saturday. Once `normalize()` + the sealer run, regenerate q1–q3 from the actual correct answers ("carbon dioxide", "chlorophyll", "true") and drop them in. Do not ship the placeholders — they will not validate against real scoring.

## The line we hold

These specs are planning. Reference the HTML prototype and design system with your eyes; re-type clean into the real build — don't fork the sample. Scoring goes in the Rust core, never JS. Core first, always.
