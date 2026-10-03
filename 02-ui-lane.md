# Acassist — Kiro Spec: UI Lane (02)

*Quiz-take, lesson render, result screen. Vanilla HTML/CSS/JS in the Tauri webview (no React — per the Team Build Sheet). Owned by the UI dev.*

> Status: SPEC (planning). The "Midnight Glass" design system (tokens.css / base.css / components.css) and the HTML sample are REFERENCE — re-type clean into the real build, do not fork the sample. Scoring is NOT done here; it crosses the boundary into Rust (see spec 01).

---

## requirements.md

### R1 — The sacred flow is the only MUST
- Load module -> render -> take quiz -> submit -> score shown. Offline. This is what the demo rests on; everything else is secondary.

### R2 — Three screens, MUST
- **Quiz-take:** one question at a time or a scrollable list; renders `multiple_choice`, `identification`, `true_false`; a progress indicator; one primary "Submit" action.
- **Lesson render:** render-only display of `lesson.blocks[]` (heading, paragraph). Unknown block kinds ignored safely.
- **Result:** score number (MUST) + per-question correct/incorrect review. Score ring is SHOULD (decorative).

### R3 — Scoring is delegated, never computed in JS
- On submit, call the Tauri bridge (`check_answer` / `score_submission` from spec 01). JS tallies the returned points. JS MUST NOT implement any correctness logic — it has no plaintext answers and must not.

### R4 — Offline is normal, never an error
- The connection chip is informational: offline = violet "everything works", online = azure "AI ready". Never amber/red for offline. No network calls on the student path.

### R5 — Honest UI copy
- Say "Scored on this device." Never "secure", "encrypted", "cheat-proof", "unbreakable". The words "hash", "salt", "seal" never appear in the UI.

### R6 — Runs on low-end hardware
- Respect `data-fx="lite"` (no backdrop blur, opaque glass) and auto-enable it for reduced-transparency / low-core devices. No WebGL, no ambient animation.

### R7 — Accessible
- 44px min hit targets (56px in `grade_level="elementary"`), visible focus ring, AA contrast, keyboard-navigable options, reduced-motion honored.

---

## design.md

### Screens → components (from the design system inventory)

| Screen | Components (MUST) | SHOULD |
|--------|-------------------|--------|
| Quiz-take | `.card`, `.option-list`/`.option` (MC/TF), `.input`/`textarea` (identification), `.progress`, `.btn` (submit), `.chip[data-conn]` | per-question transition |
| Lesson | `.lesson` reading column (h2/p), `.btn` (start/continue) | — |
| Result | score number, `.review` list (ok/no per question), `.btn` (retry/done) | `.score-ring` |
| Shell | `.topbar`, connection chip, `.alert` (AI-fallback / errors) | nav menu |

### Rendering rules
- Switch on `module.type`: `"lesson"` -> lesson view, `"quiz"` -> quiz view. A module may carry both `lesson` and `quiz`; sequence lesson -> quiz when both present.
- Render questions from `quiz.questions[]`. For MC/TF, render `options[]` as a radio-group of `.option` cards. For identification, render a single `.input`.
- Collect answers into `{questionId, rawAnswer}[]`. On submit, pass to the bridge; render `ScoreResult`.

### What this lane does NOT do
- No scoring/comparison logic. No reading of `salt`/`answer_hash` (treat them as opaque; they're Rust's).
- No accounts/login on the demo path (ROADMAP). The demo opens into a module, not a sign-in.
- No real distribution / download UI (ROADMAP) — a module is loaded from a local file via `load_module`.

---

## tasks.md

- [ ] **T1:** Build the three screens against FAKE bridge responses (hard-coded `ScoreResult`) so the UI is testable before the Rust core lands. Re-type design tokens + components from the reference system (don't fork the sample).
- [ ] **T2:** Wire the real `invoke` bridge (spec 01) once the Rust unblock signal is green (~3:30–4:00). Swap fakes for real `check_answer`.
- [ ] **T3 (CHECKPOINT ~7:30–8:30, with team):** wifi off -> load module -> take quiz -> score shown on-device. If this runs, the demo exists. Commit.
- [ ] **T4 (polish, only after checkpoint):** connection chip states, lite-mode verify on a low-end machine, elementary-mode type scale, result-screen score ring.
- [ ] **SHOULD (only if core is solid):** deterministic offline flashcard render reusing the same module JSON (front = `prompt`, back = option/explanation). First thing to cut.
