# Acassist — Kiro Spec: Tauri Command Boundary (01)

*The JS ↔ Rust interface. Signatures only — the Rust internals are the technical lead's lane (owned by Damion), NOT specced here.*

> Status: SPEC (planning). This defines the boundary the UI lane calls and the Rust core fulfills, so the two lanes can build in parallel without blocking each other. Rust implementation is out of scope for this doc by design.

---

## requirements.md

### R1 — Scoring crosses the boundary into Rust, never stays in JS
- The correctness check MUST run in the Rust core (Tauri command), not in webview JavaScript.
- Rationale (and the pitch's "Why Tauri" answer): the tamper-resistant logic is compiled in the native core, not sitting in inspectable JS. If scoring lives in JS, the strongest technical claim collapses.

### R2 — JS never sees a plaintext answer
- JS sends the student's raw (or normalized) input + the question id. Rust returns only correct/incorrect (+ optional detail). JS never receives the answer or the hash preimage.

### R3 — Normalization location is decided and documented
- EITHER JS normalizes before calling, OR Rust normalizes on receipt — but exactly ONE side does it, and the contract (`00`) records which. Recommendation: **Rust normalizes**, so the single authoritative normalizer is in the compiled core and JS cannot drift from it. (JS may do a cosmetic trim for display only.)

### R4 — Module loading is a command too
- Loading/parsing the module file is a Tauri command returning the parsed module (minus nothing — the file has no secrets beyond hashes). JS renders from what it gets back.

---

## design.md

### Commands (TypeScript-facing signatures; Rust `#[tauri::command]` on the other side)

```ts
// Load + parse a module JSON file from a local path. Validates against the schema.
// Returns the module object (lesson/quiz) for the UI to render.
invoke<Module>("load_module", { path: string })

// Score ONE answer. JS passes the question id + the student's raw input.
// Rust: look up the question's salt + answer_hash, normalize per the contract,
//       compute SHA-256(id : normalized : salt), compare, return the verdict.
// JS never receives the hash or the correct answer.
invoke<CheckResult>("check_answer", { moduleId: string, questionId: string, rawAnswer: string })

// Optional convenience: score a whole submission at once (same logic, batched).
invoke<ScoreResult>("score_submission", { moduleId: string, answers: Answer[] })
```

```ts
type CheckResult = {
  questionId: string;
  correct: boolean;
  points: number;      // points earned for this question (0 or question.points)
};

type ScoreResult = {
  correctCount: number;
  totalCount: number;
  pointsEarned: number;
  pointsPossible: number;
  perQuestion: CheckResult[];
};

type Answer = { questionId: string; rawAnswer: string };
```

### Flow (the sacred path)

```
UI: student answers  ->  invoke("check_answer", {moduleId, questionId, rawAnswer})
                              |
Rust core: normalize(rawAnswer)  ->  SHA-256(id : normalized : salt)
           compare to answer_hash  ->  { correct, points }
                              |
UI: tally points, show score   (NO network, NO plaintext answer ever crosses back)
```

### Contract notes for the UI lane
- Treat `check_answer` / `score_submission` as the ONLY way to know if an answer is right. Do not attempt any correctness logic in JS — you don't have the data to (there are no plaintext answers), and you shouldn't.
- The Rust side is being built in the same room by the technical lead; agree the exact command names at T0 so the `invoke(...)` strings match on both sides. A typo in the command name is a silent runtime failure.

---

## tasks.md

- [ ] **T0 (0:00–0:45, with technical lead):** Confirm command names + payload shapes verbatim. Decide normalization location (recommend Rust). Write the three signatures into the repo as a shared `bridge.d.ts` so JS has types to call against.
- [ ] **T1 (UI lane):** Stub the three `invoke` calls behind a tiny `api.ts` wrapper so the UI can be built against fakes until the Rust core lands.
- [ ] **T2 (technical lead, Rust):** Implement the commands (out of scope for this spec). Unblock signal: a one-question module loads, is answered, and `check_answer` returns the correct verdict offline.
- [ ] **T3 (both):** Swap the UI's fake wrapper for the real `invoke` once T2's unblock signal is green (the 3:30–4:00 handoff point).
