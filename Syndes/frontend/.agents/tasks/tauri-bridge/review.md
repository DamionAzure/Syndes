# Frontend-to-Tauri bridge wired across the spec-01 command boundary

The Next.js frontend's swap-in "ports" now reach the real Rust core instead of their browser-only fallbacks. The quiz scorer and draft sealer invoke `score_submission` and `seal_module`, a new central `bridge.ts` wraps the remaining spec-01 commands (normalize/sealAnswer/generate/scaffolds/auth), and `tauri.conf.json` is retargeted at the Next app so dev/build no longer depend on the legacy outer vite template. All command names and camelCase arg keys line up 1:1 with the 12 registered commands, the port shapes are unchanged, and no correctness logic was added in JS for real modules.

Watch for: a documented, deliberate runtime limitation — the real scorer will reject real-module ids with `ModuleNotFound` until the (out-of-scope) module-source Tauri bridge lands (confirmed), because the quiz screen still passes fixture ids that were never `load_module`'d. It degrades safely through the existing `quiz-view.tsx` catch. Verification was static-only (npm/node genuinely absent on this machine, honestly recorded, not fabricated); the authoritative typecheck/lint/test/build gate must run on the other dev's toolchain.

**Verdict**: APPROVED

## High-level view

The scorer and sealer both follow the established `access-bridge.ts` port pattern: a single `isTauri() ? real : fallback` selection point, `invoke<unknown>` then parse/validate the untrusted payload, and `AppError` mapped into the port's own failure shape rather than leaking a raw IPC error. The public `QuizScorer`/`DraftSealer` ports and the suspense `scores` cache are untouched, so existing consumers keep compiling.

The real scorer sends one batched `score_submission` and derives the "unanswered" display status on the JS side from the raw answer being empty, mirroring `fixtureQuizScorer` and `isAnswered`. Critically, `correct` is counted from the derived per-question statuses, not from the backend's `correctCount`, so an empty answer can never be counted correct. No real-module correctness logic lives in JS (spec 01 R1/R2).

The sealer passes the UI draft straight through as the `draft` arg — the `DraftModuleFile` already uses the snake_case content keys (`type`, `grade_level`, `hash_algo`, question `answer`) that the Rust `DraftModule` deserializer expects, while the command arg name stays the single word `draft`. On success it writes `modules/<id>.json` to `AppLocalData` exactly as `moduleStore.ts` does; it guards the IPC payload with `isModule` before trusting `module.id`.

`bridge.ts` is the ready-but-unconsumed wrapper for the teacher commands with no live consumer yet; it reuses `Module` and `parseAuthContext`/`AuthContext` rather than duplicating them, and validates every return. The `tauri.conf.json` change pins `next dev -p 1420` to match the existing `devUrl` and prefixes both commands with `frontend`, leaving `frontendDist`, `csp`, `withGlobalTauri`, and window settings intact.

<details>
<summary>Issues (2)</summary>

1. **Scorer load-precondition (non-blocking, documented)** — under Tauri the scorer calls `score_submission` with a fixture module id that was never registered in the Rust store via `load_module`, so it returns `ModuleNotFound` until the out-of-scope module-source bridge lands. Degrades safely via the `quiz-view.tsx` submit catch; no action required for this task, carry into the follow-up that wires the module source.
2. **Verification is static-only (non-blocking, expected)** — npm/node are absent on this machine, so typecheck/lint/test/build could not run here. The other dev must run the full suite from `frontend/` on a toolchain before shipping; the static review gives high confidence but is not the authoritative gate.

</details>

<details>
<summary>Details</summary>

### R1 — invoke() command names and camelCase arg keys

Scanned every `invoke<` call site in `frontend/src` (grep). All nine new/changed calls match a registered command exactly and use the correct arg casing:

- `draft-sealer.ts`: `invoke("seal_module", { draft: file })` — matches `seal_module(draft)`; `draft` is single-word, no camelCasing needed (commands.rs).
- `tauri-quiz-scorer.ts`: `invoke("score_submission", { moduleId, answers })` with `answers: { questionId, rawAnswer }[]` — matches `score_submission(module_id, answers: Vec<Answer>)` where `Answer` is `#[serde(rename_all = "camelCase")]` → `questionId`/`rawAnswer` (model.rs). Correct.
- `bridge.ts`: `normalize_answer({raw})`, `seal_answer({questionId, plaintextAnswer})`, `generate_module({request})`, `list_scaffolds()` (no args), `generate_from_scaffold({choice})`, `auth_online_login({accessToken, jwksUrl})`, `auth_logout()` (no args) — every name and key matches commands.rs 1:1 (`question_id`→`questionId`, `plaintext_answer`→`plaintextAnswer`, `access_token`→`accessToken`, `jwks_url`→`jwksUrl`; single-word `raw`/`request`/`choice` unchanged).

No typos, no snake_case arg-key slips, no calls to unregistered commands. The pre-existing `load_module` and `auth_resolve_role` calls (moduleStore.ts, access-bridge.ts) are untouched. (confirmed)

### R2 — real scorer goes through Rust, no JS correctness, port shape preserved

`tauri-quiz-scorer.ts` issues a single batched `score_submission` and takes the verdict only from the backend `CheckResult.correct` — there is no answer-key or comparison logic in JS (spec 01 R1/R2). The public `QuizScorer` port, `useQuizScorer()`, `useScore()`, the `ScoreResult`/`QuestionStatus` types, and the suspense `scores` cache in `quiz-scorer.ts` are unchanged; only the `activeScorer` selection line changed to `isTauri() ? tauriQuizScorer : fixtureQuizScorer`. `fixtureQuizScorer` remains the browser-only fallback (confirmed).

The backend `ScoreResult` is mapped into the frontend-local `{ correct, total, questions:[{questionId, status}] }` shape. The "unanswered" distinction is preserved by reusing `isAnswered` from `quiz-session.ts` (`answer === undefined || answer.trim() === ""`), applied on the JS side before the backend verdict is consulted — mirroring `fixtureQuizScorer`'s empty-string handling. One subtle correctness strength worth noting: `correct` is recomputed from the derived per-question statuses rather than trusting `correctCount`, so an empty answer the backend scored as "incorrect" and reclassified to "unanswered" here can never inflate the correct count (confirmed).

### R3 — sealer maps the draft correctly and writes per convention

`tauriDraftSealer.seal(file)` passes `file` straight through as the `draft` arg. This is correct against model.rs: the command arg name is the single word `draft`, while the content object's fields stay snake_case (`schema_version`, `module.type` via `#[serde(rename = "type")]`, `grade_level`, `hash_algo`, question `answer`, `points`). `module-file.ts` `toDraftModuleFile` already emits exactly those snake_case keys, so no remapping is needed and none is done (confirmed against model.rs `DraftModule`/`DraftQuiz`/`DraftQuestion`).

Outcomes match the port: `{status:"sealed", fileName}` on success, `{status:"invalid", message}` for a thrown `AppError` (covering `Forbidden`/`ValidationError`), and `{status:"unsupported"}` outside Tauri. The sealed `Module` is written to `modules/<module.id>.json` under `BaseDirectory.AppLocalData` after `mkdir("modules", { recursive: true })` — identical to the `pullModule` convention in `moduleStore.ts`. The untrusted IPC payload is guarded by `isModule` (object with a string `module.id`) before `module.id` is read, satisfying the security-standards "narrow IPC payloads" rule. The `SealOutcome` union is unchanged, and its only consumer `seal-panel.tsx` (which indexes `SealOutcome["status"]`) stays compatible (confirmed).

### R4 — bridge.ts typed wrappers

`bridge.ts` exports the seven required wrappers (`normalizeAnswer`, `sealAnswer`, `generateModule`, `listScaffolds`, `generateFromScaffold`, `authOnlineLogin`, `authLogout`), each `isTauri()`-guarded, each parsing/validating its payload (`parseSealedAnswer`, `parseScaffold`, `parseModule`, string/array checks). `readAppError` reads any throw into `{ kind, message }` so callers can branch on `kind` (notably `Forbidden`). It reuses `Module` from `@/lib/types` and `parseAuthContext`/`AuthContext` from `@/lib/access/access` rather than duplicating them, and the backend `ScoreResult` type is named `BackendScoreResult` to avoid colliding with the quiz port's local `ScoreResult` (confirmed).

Grep confirms there is no existing generate/scaffold/normalize/sealAnswer consumer in `src/`, so `bridge.ts` is intentionally bridged-but-unconsumed — the plan explicitly scopes item 4 to "do not invent UI." No fixture fallback was ripped out anywhere. The off-Tauri branch throws `BridgeUnavailableError` rather than returning a silent fallback; acceptable since these wrappers have no consumer yet and the throw is explicit, but the future teacher UI must catch it (worth a note for whoever wires the consumer). (confirmed)

### R5 — tauri.conf.json retargeting

`beforeDevCommand` is now `npm run dev --prefix frontend -- -p 1420` and `beforeBuildCommand` is `npm run build --prefix frontend`; both target the Next app regardless of Tauri's cwd. `devUrl` stays `http://localhost:1420` and the dev command pins `-p 1420` to match it — self-consistent. `frontendDist` stays `../frontend/out` (correct for Next `output: "export"`). `withGlobalTauri`, `security.csp`, the window block, `bundle`, `identifier`, `productName`, and `version` are untouched, and the JSON is well-formed (confirmed). The chosen port-pin is one of two equally-correct options the plan weighed; the alternative (`devUrl` → 3000) was reasonably rejected to keep `devUrl` stable.

### R6 — scope boundaries honored

`git diff --stat` plus the untracked-file listing show exactly: edits to `draft-sealer.ts`, `quiz-scorer.ts`, `tauri.conf.json`, and new `tauri-quiz-scorer.ts` and `bridge.ts`. `moduleStore.ts` `load_module` and `access-bridge.ts` `auth_resolve_role` bridges are untouched. No `src-tauri/src/*.rs` edits. No new libraries — `@tauri-apps/api` 2.12.1 and `@tauri-apps/plugin-fs` ^2.6.0 are already in `package.json`. Working tree is uncommitted on `main`; no commit or push. The legacy outer vite template was not deleted (confirmed).

### R7 — repo standards and port pattern

The scorer and sealer follow the `access-bridge.ts` pattern precisely: `isTauri()` guard → `invoke<unknown>` → parse/validate → map `AppError` to the port's failure shape. The sealer follows `moduleStore.ts` for fs writes. All type-only imports use `import type` (`verbatimModuleSyntax`), untrusted payloads are read via bracket access on `Record<string, unknown>` (`noPropertyAccessFromIndexSignature`/`noUncheckedIndexedAccess`), and there are no `any`, non-null assertions, or `@ts-ignore` in the diff. The type-only cycle `quiz-scorer.ts ↔ tauri-quiz-scorer.ts` mirrors the existing `fixture-quiz-scorer.ts` cycle and is erased at compile time (confirmed by reading all touched files).

### Runtime limitation — scorer load-precondition

The quiz screen passes `useModuleParam().id` (fixture-sourced ids like `photosynthesis`) to `scorer.score`. Those ids were never registered in the Rust `ModuleStore` via `load_module`, so under Tauri `score_submission` returns `AppError::ModuleNotFound`. This is a known, documented limitation (plan "KEY VERIFIED FACTS" and residual-risk section), not introduced carelessly: it fails safe because `quiz-view.tsx submit()` wraps the call in `try/catch`, sets `submitError`, and shows the non-destructive "could not be scored on this device" alert (confirmed by reading quiz-view.tsx lines 74-81, 114-117). No JS scoring fallback was added to paper over it (spec 01 R1/R2 respected). It resolves when the out-of-scope module-source Tauri bridge lands. Non-blocking.

### Verification evidence

The plan records that `node --version`/`npm --version` fail with CommandNotFoundException and `node_modules` is absent, so typecheck/lint/test/build could not run on this machine. This is honestly disclosed and not fabricated, and the plan performed a detailed static review against the strict tsconfig and the exact command/arg table. Per the review's verification discipline, I did not re-run the suites. I did one spot-check — a grep of every `invoke<` call site for command-name/arg typos — which came back clean. The authoritative gate (full suite on a toolchain) remains the other dev's responsibility, as the plan states. Non-blocking.

</details>

<details>
<summary>File map</summary>

- `frontend/src/features/quiz/tauri-quiz-scorer.ts` (new) — real `QuizScorer`: batched `score_submission`, backend→local mapping, JS-side "unanswered" via `isAnswered`.
- `frontend/src/features/quiz/quiz-scorer.ts` — `activeScorer` now `isTauri() ? tauriQuizScorer : fixtureQuizScorer`; port/cache unchanged.
- `frontend/src/features/authoring/draft-sealer.ts` — real `tauriDraftSealer`: `seal_module` + AppLocalData write + `isModule` guard; selection line updated.
- `frontend/src/lib/bridge.ts` (new) — central wrapper + types for the remaining spec-01 commands; validators mirror `parseAuthContext`.
- `src-tauri/tauri.conf.json` — dev/build commands retargeted at `frontend` with `-p 1420`; `frontendDist`/csp/window intact.

Full diff: `git diff main` (plus the two untracked files above).

</details>
