# Acassist — Kiro Spec: Rust Scoring Core (04)

*The protected MUST — offline device-neutral scoring, module loading, and the authoritative normalizer. Owned by the technical lead (Damion). This is the novel core; it hits the ✅ checkpoint first.*

> Status: SPEC (planning). Defines WHAT the core does and the contracts it honors; the technical lead owns the HOW. Written to respect specs 00 (module contract) and 01 (command boundary) exactly.

> Code style for generation: readable, with comments that explain **why**, not **what**. Comment the non-obvious decisions (why normalization is centralized here, why low-entropy answers aren't a security claim); leave self-explanatory code uncommented.

---

## requirements.md

### R1 — Scoring runs in the native core, never in JS
- Answer verification MUST execute in Rust (Tauri commands). The webview never computes correctness. This is the pitch's "Why Tauri" claim — the tamper-resistant logic is compiled in, not inspectable JS.

### R2 — Device-neutral hashing
- `answer_hash = SHA-256( question_id : normalized_answer : salt )`. No device id. Same module scores identically on any device, distributed any way (file / USB / network). This IS the novel core.

### R3 — The core owns the one authoritative normalizer
- `normalize()` lives HERE and is the single source of truth. The seal step (teacher lane) calls this same normalizer (via command) so seal-time and check-time can never drift. Rationale: a mismatch produces "correct answer marked wrong" bugs — the #1 cross-lane risk — and centralizing in one compiled function removes the class entirely.

### R4 — No plaintext answers in, through, or out
- The core reads only `salt` + `answer_hash` from the module. It recomputes the hash from what the student typed and compares. It never stores, logs, or returns a plaintext answer or the preimage.

### R5 — Offline, always
- No network calls anywhere in the core. Scoring must work with the radio off. Online is only ever the teacher-side easy case, handled in a different lane.

### R6 — Fail safe and legible
- Module parse errors, unknown question kinds, or missing fields return a typed error the UI can render as an inline alert — never a silent wrong score, never a panic that takes down the webview.

---

## design.md

### Tauri commands (fulfilling spec 01)

```rust
// Load + parse + validate a module file from a local path.
// Returns the module (lesson/quiz) for the UI to render. Hashes/salts stay in the struct;
// they are not secret (they're already in the file) but the UI treats them as opaque.
#[tauri::command]
fn load_module(path: String) -> Result<Module, AppError>;

// Score ONE answer. Look up the question's salt + answer_hash by (module_id, question_id),
// normalize the raw input with the ONE normalizer, hash, compare. Return only the verdict.
#[tauri::command]
fn check_answer(module_id: String, question_id: String, raw_answer: String)
    -> Result<CheckResult, AppError>;

// Batched convenience: same logic over a whole submission.
#[tauri::command]
fn score_submission(module_id: String, answers: Vec<Answer>)
    -> Result<ScoreResult, AppError>;

// Exposed so the SEAL step (teacher lane) uses the SAME normalizer — no second implementation.
#[tauri::command]
fn normalize_answer(raw: String) -> String;
```

### The normalizer (the load-bearing function — spec 00 R3)

```
normalize(s):
  1. Unicode NFC
  2. lowercase
  3. trim leading/trailing whitespace
  4. collapse internal whitespace runs to a single space
  5. strip Unicode punctuation (category P*)
  // diacritics are KEPT ("josé" stays "josé"); accent-insensitivity is a contract change, not a default
```

### The hash + compare (R2, R4)

```
seal (teacher side, via this core's normalizer):
    salt = 16 random bytes (hex)
    answer_hash = hex( SHA-256( question_id : normalize(correct_answer) : salt ) )

check (student side):
    computed = hex( SHA-256( question_id : normalize(raw_answer) : salt ) )
    correct  = constant_time_eq(computed, answer_hash)
    // honest note (comment in code): constant-time compare is good hygiene, but MC/TF answers
    // are low-entropy and the salt ships in the file — this is tamper-resistant, NOT unbreakable.
    // Do not let the code or its comments imply cryptographic secrecy.
```

Separator note: `question_id`, the normalized answer, and `salt` are joined with `:`. Because ids/salts are controlled hex/opaque and the answer is in the middle, a literal `:` typed by a student is harmless (it is inside the normalized answer segment). Keep the separator identical in seal and check — it is part of the contract.

### Types (match spec 01 verbatim)

```rust
struct Module { schema_version: String, module: Meta, lesson: Option<Lesson>, quiz: Option<Quiz> }
struct CheckResult { question_id: String, correct: bool, points: u32 }
struct ScoreResult { correct_count: u32, total_count: u32,
                     points_earned: u32, points_possible: u32, per_question: Vec<CheckResult> }
struct Answer { question_id: String, raw_answer: String }
enum AppError { ModuleNotFound, ParseError(String), UnknownQuestionKind(String), MissingField(String) }
```

### Out of scope (do NOT build Saturday)
- Device binding / bind-at-download / PIN (ROADMAP — every variant either needs a live host or ships recoverable answers, so it is invisible on stage).
- Argon2/bcrypt tuning (a stronger hash doesn't fix low-entropy reverse-engineering; don't spend hours on an invisible property).
- Any network, sync, or server-side scoring.

---

## tasks.md

- [ ] **T0 (0:00–0:45, with team):** Confirm command names + types match spec 01 verbatim. Agree the normalizer rule (spec 00) out loud.
- [ ] **T1 (0:45–3:30) — DRIVE TO THE UNBLOCK SIGNAL:** JSON module schema + loader; `normalize()`; `check_answer` hashing + compare. Target: a one-question module loads, is answered offline, and scores correctly.
- [ ] **T2 (3:30–4:00) — UNBLOCK POINT:** scoring round-trip proven; hand the real `invoke` bridge to the UI lane (they swap their fakes).
- [ ] **T3:** `score_submission` batching; typed `AppError`s surfaced to the UI; expose `normalize_answer` for the seal step so there is one normalizer.
- [ ] **T4 (✅ CHECKPOINT ~7:30–8:30, with team):** wifi off → load module → take quiz → scored on-device → score shown. If green, the demo exists. Commit.
