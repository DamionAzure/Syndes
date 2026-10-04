# Implementation Plan — Tauri bridge (frontend ↔ Rust command boundary)

Wire the Acassist Next.js frontend to the already-built Tauri Rust backend across
the spec-01 command boundary. Implement the swap-in "ports" against the REAL Rust
commands, add the missing central command wrapper, and reconcile the Tauri
dev/build config. Work directly on `main`. Do NOT edit Rust (`src-tauri/src/*.rs`),
do NOT delete the legacy outer vite template, do NOT commit or push.

All paths are Windows absolute. Frontend root referenced below as:
`c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\frontend`

---

## Environment / verification reality (read first)

- **No Rust toolchain** on this machine — never `cargo`/`tauri` anything. The Rust
  backend is built and correct; verified by reading `src-tauri/src/*.rs`.
- **Node/npm are NOT on PATH** on this machine (`node --version` / `npm --version`
  both fail with CommandNotFoundException). So the automated frontend checks below
  (`npm run typecheck|lint|test|build`) likely **cannot be run here**. The
  implementer MUST first re-check availability:
  - `npm --version` from the frontend dir. If it works, run the real checks.
  - If it still fails, fall back to a **careful static review** against the strict
    TS config and the exact command/arg names tabulated at the end of this plan —
    and say so plainly in the report. Do NOT fabricate check output.
- `tsconfig` is strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, `noPropertyAccessFromIndexSignature`, etc.). Use
  `import type`, narrow all IPC payloads, and avoid `any`/non-null assertions
  (CODING_STANDARDS.md, docs/standards/typescript-standards.md).

## Verification commands (run from the frontend dir when npm is available)

```
cd c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\frontend
npm run typecheck   # tsc --noEmit — expect: no errors
npm run lint        # eslint — expect: no errors
npm run test        # vitest --run — expect: existing suites pass (authoring draft-checks.test.ts etc.)
npm run build       # next build (static export to ./out) — expect: success, out/ produced
```

The Tauri JSON change (D) cannot be runtime-verified without Rust/npm; verify it by
static inspection against the rules in step D.

---

## Bridge pattern to follow EXACTLY (from `src/lib/access/access-bridge.ts`)

1. `import { invoke, isTauri } from "@tauri-apps/api/core";`
2. Guard every call: `if (!isTauri()) return <safe fallback>;`
3. `await invoke<unknown>("command_name", { camelCaseArg: value })` — type the
   generic as `unknown` and then **parse/validate**, or type it to a vetted shape
   only when you also validate; mirror `parseAuthContext`.
4. On throw, map the Rust `AppError` (`{ kind: string, message: string }`) to the
   port's existing failure shape; never let a raw IPC error escape the port.
5. Never implement correctness/scoring logic in JS for real modules (spec 01 R1/R2).

---

## KEY VERIFIED FACTS (ground truth for the implementer)

- **Backend command surface** = the 12 commands registered in
  `src-tauri/src/lib.rs` `invoke_handler!` (verified). Full name/arg table at the
  end of this plan.
- **Arg key casing**: Rust params are snake_case; Tauri exposes them to JS as
  **camelCase**. So `raw_answer` → `rawAnswer`, `module_id` → `moduleId`,
  `question_id` → `questionId`, `require_privileged` → `requirePrivileged`,
  `access_token` → `accessToken`, `jwks_url` → `jwksUrl`,
  `plaintext_answer` → `plaintextAnswer`. Single-word params (`path`, `raw`,
  `draft`, `request`, `choice`, `answers`) are unchanged.
- **MODULE CONTENT keys stay snake_case** inside payload *objects* (the DraftModule
  content): `schema_version`, `grade_level`, `hash_algo`, `answer_hash`, and
  `type` (Rust `ModuleMeta` uses `#[serde(rename = "type")]`). This is the real
  gotcha: command *arg names* are camelCase, but the draft object's *fields* are
  snake_case. The frontend `DraftModuleFile` type already uses the correct
  snake_case keys (see `module-file.ts`), so **no key remapping is needed** for B.
- **`DraftModuleFile` already matches Rust `DraftModule` exactly** — verified field
  by field against `src-tauri/src/model.rs` (`DraftModule`/`DraftQuiz`/
  `DraftQuestion`) and against `draft-checks.test.ts` which asserts the emitted
  shape (`{ id, type:"quiz", title, subject, grade_level }`, questions with
  `{ id, kind, prompt, options?, answer, points }`). Pass the result of
  `toDraftModuleFile(draft)` straight through as the `draft` arg; do NOT transform.
- **`seal_module`, `seal_answer`, `generate_module`, `list_scaffolds`,
  `generate_from_scaffold` are RBAC-gated** in `commands.rs` via
  `require_teacher(...)`: a non-teacher (or unauthenticated) session gets
  `AppError::Forbidden`. Error mapping MUST account for `kind === "Forbidden"`.
- **Scaffold / Scaffattempt types** (verified against `src-tauri/src/scaffold.rs`,
  serde camelCase):
  - `Scaffold = { id, label, subject, gradeLevel, topicHint, suggestedQuestionCount, description }`
  - `ScaffoldChoice = { scaffoldId, topic?, gradeLevel?, numQuestions? }`
  - `GenerationRequest = { topic, subject?, gradeLevel?, sourceText?, numQuestions? }`
    (verified against `src-tauri/src/groq.rs`).
  - `SealedAnswer = { salt, answerHash }`.
- **CheckResult/ScoreResult** (verified `model.rs`, camelCase):
  - `CheckResult = { questionId, correct, points }`
  - `ScoreResult = { correctCount, totalCount, pointsEarned, pointsPossible, perQuestion: CheckResult[] }`

### ⚠️ Scorer load-precondition — the biggest risk, FLAGGED for in-context verify

`score_submission(moduleId, ...)` only works if the module was previously
registered in the Rust `ModuleStore` under that exact `module.id` (via
`load_module`). Verified facts:

- `quiz-view.tsx` calls `scorer.score(found.id, answers)` where `found` comes from
  `useModuleParam()` → `module-source.ts` → **`fixtureModuleSource`** (the active
  source is still the fixture; its Tauri bridge is NOT in this task's scope).
- The fixture `Module` ids are things like `"photosynthesis"` / `"problem-solving"`
  (`fixture-modules.ts`), which are **not** the sealed Rust module ids
  (`mod_science_photosynthesis_01`) and are **never** `load_module`'d.
- `moduleStore.ts.pullModule(id)` DOES call `load_module({ path })` and registers
  the module under `module.module.id`, but nothing wires `pullModule` into the
  student quiz screen yet.

**Consequence:** in the current app, when `isTauri()` is true the real scorer would
call `score_submission` with a fixture id the Rust store has never seen, and Rust
returns `AppError::ModuleNotFound`. **Decision for this task:** build the real
`tauriQuizScorer` correctly (batched `score_submission`, correct arg keys, correct
mapping) and select it under `isTauri()`, BUT the implementer MUST verify, in
context, whether the quiz screen guarantees the module is `load_module`'d under the
same id before scoring. If it does not (current reading says it does not), the real
scorer will surface `ModuleNotFound` at runtime until the module-source bridge
lands. Document this limitation in the PR notes rather than silently papering over
it, and do NOT invent a JS fallback that scores real modules (spec 01 R1/R2). The
`catch` in `quiz-view.tsx submit()` already shows a non-destructive "could not be
scored on this device" error, so a `ModuleNotFound` throw degrades safely.

---

## IMPLEMENTATION RECORD (first iteration — completed)

All six items implemented. Files touched:

- NEW `src/lib/bridge.ts` — central wrapper + types (item 1).
- EDIT `src/features/authoring/draft-sealer.ts` — real `tauriDraftSealer`,
  `activeSealer = isTauri() ? tauriDraftSealer : unavailableSealer` (item 2).
- NEW `src/features/quiz/tauri-quiz-scorer.ts` — real scorer (item 3).
- EDIT `src/features/quiz/quiz-scorer.ts` — `activeScorer = isTauri() ?
  tauriQuizScorer : fixtureQuizScorer`; port/useScore/suspense cache unchanged (item 3).
- EDIT `src-tauri/tauri.conf.json` — `beforeDevCommand` / `beforeBuildCommand`
  now `--prefix frontend`, dev pinned to `-p 1420` to match `devUrl` 1420;
  `frontendDist` unchanged (item 5).
- Item 4: grep confirmed NO existing generate/scaffold/normalize/sealAnswer
  consumer in `src/`; `bridge.ts` is the ready, unconsumed wrapper. No UI invented.

### Verification evidence (npm UNAVAILABLE — static review performed)

`node --version` and `npm --version` both fail with CommandNotFoundException on
this machine, and `frontend/node_modules` does NOT exist. The automated checks
(`npm run typecheck|lint|test|build`) therefore COULD NOT be run here — results
are NOT fabricated. A rigorous static review was done instead:

- Command names verified 1:1 against `src-tauri/src/lib.rs` invoke_handler and
  `commands.rs` signatures; arg keys are camelCase (`questionId`,
  `plaintextAnswer`, `accessToken`, `jwksUrl`, `moduleId`, `rawAnswer`); single-
  word params (`raw`, `request`, `choice`, `draft`, `answers`) unchanged;
  `list_scaffolds`/`auth_logout` take no args.
- Return shapes verified against `model.rs` (CheckResult/ScoreResult/SealedAnswer
  camelCase), `scaffold.rs` (Scaffold/ScaffoldChoice), `groq.rs`
  (GenerationRequest fields → `topic/subject/gradeLevel/sourceText/numQuestions`).
- `verbatimModuleSyntax`: all type-only imports use `import type`; value imports
  (`invoke`, `isTauri`, `isAnswered`, `writeTextFile`, `mkdir`, `BaseDirectory`,
  `tauriQuizScorer`) are value imports.
- `noUncheckedIndexedAccess`/`noPropertyAccessFromIndexSignature`: all untrusted
  payloads read via bracket access on `Record<string, unknown>`, mirroring
  `access.ts` `parseAuthContext`; `answers[id]` typed `string | undefined` is
  passed to `isAnswered(answer: string | undefined)`.
- No `any`, no non-null assertions, no `@ts-ignore`.
- Type-only import cycle `quiz-scorer.ts ↔ tauri-quiz-scorer.ts` mirrors the
  existing `fixture-quiz-scorer.ts` cycle (erased at compile — safe).
- Tauri `invoke<T>(cmd, args?)` second arg optional → no-arg calls valid.
- JSON validity of `tauri.conf.json` confirmed by inspection; dev command port
  (1420) matches `devUrl` (1420); `withGlobalTauri`/`csp`/windows/bundle untouched.

The other dev MUST run `npm install` then
`npm run typecheck && npm run lint && npm run test && npm run build` from
`frontend/` on a machine with the toolchain; the static review gives high
confidence those pass, but they are the authoritative gate.

### Flagged residual risks (restated for reviewer)

1. **Scorer load precondition (HIGH):** quiz screens pass
   `useModuleParam().id`, sourced from `fixtureModuleSource`
   (`features/modules/module-source.ts` `activeSource` is still the fixture), so
   those ids are NOT `load_module`'d into the Rust ModuleStore. Under Tauri,
   `score_submission` will reject real-module ids with
   `AppError::ModuleNotFound` until the module-source Tauri bridge (out of scope)
   lands. The `quiz-view.tsx` submit `catch` degrades safely. No JS scoring added.
2. **Bridge C consumers:** none exist yet (verified by grep). `bridge.ts` is
   bridged-but-unconsumed, ready for future teacher UI.

---

## Ordered items

- [x] 1. Add shared bridge types + the central command wrapper in a NEW file
      `src/lib/bridge.ts`.
      Define TS types `CheckResult`, `ScoreResult` (backend shape — name it
      `BackendScoreResult` to avoid colliding with the quiz port's local
      `ScoreResult`), `Scaffold`, `ScaffoldChoice`, `GenerationRequest`,
      `SealedAnswer`, and an `AppError` reader `{ kind, message }`. REUSE `Module`
      from `@/lib/types` and `AuthContext`/`parseAuthContext` from
      `@/lib/access/access` — do NOT duplicate them. Export thin, `isTauri()`-guarded,
      payload-validating wrappers: `normalizeAnswer(raw)`, `sealAnswer(questionId,
      plaintextAnswer)`, `generateModule(request)`, `listScaffolds()`,
      `generateFromScaffold(choice)`, `authOnlineLogin(accessToken, jwksUrl)`,
      `authLogout()`. Each uses the exact command name + camelCase arg keys from the
      table below, parses the IPC payload (array/object/string shape checks, mirror
      `parseAuthContext`), and exposes a small `readAppError(e): { kind, message }`
      helper so callers can branch on `kind` (notably `"Forbidden"`). Do NOT include
      `load_module` (owned by `moduleStore.ts`) or `auth_resolve_role` (owned by
      `access-bridge.ts`); `check_answer`/`score_submission` live with the scorer
      (item 3), not here.
      Files: `c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\frontend\src\lib\bridge.ts`
      Verify: `npm run typecheck` and `npm run lint` pass (or static review of the
      arg-key table + strict-TS compliance if npm is unavailable).

- [x] 2. Implement the real draft sealer and select it under `isTauri()` in
      `src/features/authoring/draft-sealer.ts`.
      Add `tauriDraftSealer: DraftSealer`. In `seal(file)`: if `!isTauri()` return
      `{ status: "unsupported" }` (keep this fallback). Otherwise
      `invoke<unknown>("seal_module", { draft: file })` — `file` is already a
      `DraftModuleFile` whose keys match Rust `DraftModule` exactly (verified; no
      remapping). On success you get a sealed `Module`; **write it to disk** the way
      `moduleStore.ts` writes module files: `mkdir("modules", { baseDir:
      BaseDirectory.AppLocalData, recursive: true })` then `writeTextFile(
      ``modules/${sealed.module.id}.json``, JSON.stringify(sealed), { baseDir:
      BaseDirectory.AppLocalData })` (import `writeTextFile`, `mkdir`,
      `BaseDirectory` from `@tauri-apps/plugin-fs`). Return `{ status: "sealed",
      fileName: ``${sealed.module.id}.json`` }`. On throw, read the `AppError`;
      return `{ status: "invalid", message }` (this also covers `kind:"Forbidden"`
      — the seal panel shows the message, which is acceptable). Change
      `activeSealer` to `isTauri() ? tauriDraftSealer : unavailableSealer`. Keep the
      `DraftSealer`/`SealOutcome` port shapes and `useDraftSealer()` unchanged so
      `seal-panel.tsx` keeps compiling.
      Note: validate the returned `Module` minimally before writing (object with a
      `module.id` string) — IPC payloads are untrusted (security-and-privacy
      standards). You MAY reuse a small guard from `bridge.ts` (item 1).
      Files: `c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\frontend\src\features\authoring\draft-sealer.ts`
      Verify: `npm run test` (authoring suite still passes), `npm run typecheck`,
      `npm run lint` — or static review. The sealer has one consumer, `seal-panel.tsx`;
      confirm its `SealOutcome` switch still type-checks.

- [x] 3. Implement the real quiz scorer and select it under `isTauri()` in
      a NEW file `src/features/quiz/tauri-quiz-scorer.ts`, then wire it in
      `src/features/quiz/quiz-scorer.ts`.
      New `tauriQuizScorer: QuizScorer` implementing `score(moduleId, answers:
      Record<string,string>)`. Prefer ONE batched `score_submission` call:
      build `answers:{questionId,rawAnswer}[]` from the record's entries
      (`Object.entries`), passing every entry (empty strings included — the backend
      scores them as incorrect; unanswered is a JS-side display distinction, see
      below). `invoke<unknown>("score_submission", { moduleId, answers })`, validate
      the payload into `BackendScoreResult`. **Map backend → the quiz port's local
      `ScoreResult`** (`{ correct, total, questions:{questionId,status}[] }`):
      - `status` per question: decide `"unanswered"` on the JS side FIRST — if the
        raw answer for that `questionId` is empty/whitespace (reuse the
        `isAnswered` logic from `quiz-session.ts`, i.e. `answer === undefined ||
        answer.trim() === ""` ⇒ `"unanswered"`); otherwise derive from the backend
        `CheckResult.correct` for that question (`correct ? "correct" :
        "incorrect"`). This mirrors `fixtureQuizScorer`'s "unanswered" distinction.
      - `correct` = count of questions whose derived status is `"correct"` (do NOT
        just trust `correctCount` if an empty answer could ever be marked correct;
        for safety derive from the per-question statuses you just built).
      - `total` = the number of questions in the backend `perQuestion` (one entry
        per submitted answer). Keep the local shape's `questions` array in the same
        order as `perQuestion`.
      In `quiz-scorer.ts`: change `const activeScorer = isTauri() ? tauriQuizScorer
      : fixtureQuizScorer;` (import `isTauri` from `@tauri-apps/api/core`, import
      `tauriQuizScorer` from `./tauri-quiz-scorer`). Keep the `QuizScorer` port,
      `useQuizScorer()`, `useScore()`, the `ScoreResult`/`QuestionStatus` types, and
      the suspense `scores` cache EXACTLY as-is — note `useScore` currently
      references `activeScorer` directly, so leaving `activeScorer` as the single
      selection point keeps it correct. NEVER compute correctness in JS for real
      modules — the verdict comes only from Rust (spec 01 R1/R2). `fixtureQuizScorer`
      stays the browser-only fallback.
      ⚠️ Carry forward the **load-precondition caveat** (see KEY VERIFIED FACTS):
      verify in-context whether `found.id` is a Rust-registered module id before
      relying on runtime success; document if not.
      Files:
      `c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\frontend\src\features\quiz\tauri-quiz-scorer.ts` (new),
      `c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\frontend\src\features\quiz\quiz-scorer.ts` (edit)
      Verify: `npm run typecheck`, `npm run lint`, `npm run test` (fixture scorer
      path unaffected), `npm run build` — or static review. Confirm `quiz-view.tsx`
      still compiles against the unchanged `QuizScorer` port.

- [x] 4. Wire the central bridge (item 1) into any EXISTING teacher consumers,
      guarded by `isTauri()`, without removing fixture fallbacks.
      ⚠️ **Verified gap:** there is currently **no** generate/scaffold UI in the
      frontend (grep for `generate`/`scaffold`/`Scaffold` across `src/app` and
      `src/features` finds nothing invoking those commands), and there is **no**
      `features/school-*` generation feature. The only teacher command with a live
      consumer is `seal_module` (handled in item 2). Therefore: do NOT invent new UI.
      This item is: (a) confirm by grep that no stub currently calls
      generate/scaffold/normalize/sealAnswer; (b) if a stub IS found, replace its
      active impl behind an `isTauri()` check using the `bridge.ts` wrappers (same
      pattern as the scorer/sealer), keeping the fixture/fallback branch; (c) if
      none is found, leave `bridge.ts` as the ready, tested wrapper for the future
      UI and record in the PR notes that these commands are bridged but not yet
      consumed. Do NOT rip out working fixture fallbacks anywhere.
      Files: none expected to change beyond item 1 unless a stub is discovered
      (then the specific feature file under
      `c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\frontend\src\features\...`).
      Verify: `grep` (search tool) for the command/wrapper names returns no
      unwired stub; `npm run typecheck`/`lint` still pass — or static review.

- [x] 5. Reconcile the Tauri dev/build config in
      `c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\src-tauri\tauri.conf.json`.
      Current `build` block points at the OLD outer vite template
      (`beforeDevCommand: "npm run dev"`, `beforeBuildCommand: "npm run build"` run
      with cwd = outer `Syndes/`) and `devUrl: http://localhost:1420`, while the
      Next.js frontend lives in `frontend/` and `next dev` serves on **3000** by
      default. `frontendDist: "../frontend/out"` is already CORRECT for Next
      `output: "export"`. **Decision (pick ONE, chosen here): pin the Next dev
      server to 1420 and keep `devUrl` at 1420**, because it is the smallest,
      most self-consistent change and leaves `devUrl` untouched. Apply:
      - `"beforeDevCommand": "npm run dev --prefix frontend -- -p 1420"`
      - `"beforeBuildCommand": "npm run build --prefix frontend"`
      - keep `"devUrl": "http://localhost:1420"`
      - keep `"frontendDist": "../frontend/out"`
      Rationale recorded here: `--prefix frontend` makes both commands target the
      Next app regardless of Tauri's cwd (the outer dir); `-- -p 1420` forwards the
      port flag to `next dev` so it matches `devUrl`; `frontendDist` already matches
      the static export dir. Do NOT touch `withGlobalTauri`, `security.csp`, window
      settings, `bundle`, `identifier`, `productName`, or `version`. Do NOT delete
      the legacy outer vite template; this change simply stops Tauri from depending
      on it.
      (Alternative considered and rejected for being a larger change: leave Next on
      3000 and set `devUrl` to `http://localhost:3000`. Equivalent correctness;
      chose the port-pin to keep `devUrl` stable.)
      Files: `c:\Users\DELL\Documents\DOCUMENTS\Syndes\Syndes\Syndes\src-tauri\tauri.conf.json`
      Verify: static inspection only (no Rust/Tauri toolchain here). Confirm the
      JSON is valid, the two commands reference `--prefix frontend`, the dev port in
      the command matches `devUrl` (1420), and `frontendDist` is unchanged. If npm
      is available you MAY sanity-check `npm run build --prefix frontend` from the
      outer `Syndes/` dir produces `frontend/out`.

- [x] 6. Final gate: run the full frontend check suite (or the documented static
      fallback) and summarize residual risks.
      Files: none.
      Verify: from the frontend dir run `npm run typecheck && npm run lint &&
      npm run test && npm run build`; expect all green. If npm is unavailable, state
      that clearly and provide the static-review results instead. In the summary,
      restate the two FLAGGED items for the reviewer: (1) the scorer load-precondition
      (`found.id` is a fixture id not registered in the Rust store; `score_submission`
      may return `ModuleNotFound` until the module-source bridge lands) and (2)
      whether any generate/scaffold stub consumer was found for `bridge.ts`.

---

## Registered command names + exact camelCase arg keys (grep target for typos)

| # | invoke name | arg object keys (camelCase) | returns | owned by |
|---|-------------|-----------------------------|---------|----------|
| 1 | `load_module` | `{ path }` | `Module` | `lib/moduleStore.ts` (leave as-is) |
| 2 | `check_answer` | `{ moduleId, questionId, rawAnswer }` | `CheckResult` | quiz scorer (item 3) — batched path prefers #3 |
| 3 | `score_submission` | `{ moduleId, answers }` where `answers: { questionId, rawAnswer }[]` | `ScoreResult` | quiz scorer (item 3) |
| 4 | `normalize_answer` | `{ raw }` | `string` | `bridge.ts` (item 1) |
| 5 | `seal_module` | `{ draft }` (draft fields snake_case: `schema_version`, `module.type`, `grade_level`, `hash_algo`, `answer_hash`) | `Module` | `draft-sealer.ts` (item 2); RBAC-gated |
| 6 | `seal_answer` | `{ questionId, plaintextAnswer }` | `SealedAnswer` `{ salt, answerHash }` | `bridge.ts` (item 1); RBAC-gated |
| 7 | `generate_module` | `{ request }` where `request: { topic, subject?, gradeLevel?, sourceText?, numQuestions? }` | `Module` | `bridge.ts` (item 1); RBAC-gated |
| 8 | `list_scaffolds` | `{}` (no args) | `Scaffold[]` `{ id, label, subject, gradeLevel, topicHint, suggestedQuestionCount, description }` | `bridge.ts` (item 1); RBAC-gated |
| 9 | `generate_from_scaffold` | `{ choice }` where `choice: { scaffoldId, topic?, gradeLevel?, numQuestions? }` | `Module` | `bridge.ts` (item 1); RBAC-gated |
| 10 | `auth_online_login` | `{ accessToken, jwksUrl }` | `AuthContext` `{ role, readOnly, source }` | `bridge.ts` (item 1) |
| 11 | `auth_resolve_role` | `{ requirePrivileged }` | `AuthContext` | `access-bridge.ts` (leave as-is) |
| 12 | `auth_logout` | `{}` (no args) | `void` | `bridge.ts` (item 1) |

Error envelope for every command: `AppError = { kind: string, message: string }`
(serde `tag="kind", content="message"`). Teacher commands (#5–#9) may return
`kind: "Forbidden"`. Scoring/loading may return `kind: "ModuleNotFound"`,
`"QuestionNotFound"`, `"ParseError"`, `"ValidationError"`, `"UnknownQuestionKind"`,
`"MissingField"`.

## Flagged items the implementer must verify in-context

1. **Scorer load precondition (HIGH):** confirm whether the quiz screen loads the
   module into the Rust `ModuleStore` (via `load_module`/`pullModule`) under the
   same id passed to `score_submission`. Current reading: it does NOT (student view
   model is fixture-sourced). Expect `ModuleNotFound` at runtime for real modules
   until the module-source Tauri bridge (out of scope here) lands; the existing
   submit `catch` degrades safely. Do not add JS scoring.
2. **Bridge C consumers:** confirm by grep there is no existing generate/scaffold
   stub to wire; if one appears, wire it behind `isTauri()` (item 4).
3. **Dev-port choice (D):** the plan pins `next dev -p 1420` to match the existing
   `devUrl`. If the team prefers 3000, the equivalent change is `devUrl:
   http://localhost:3000` with `beforeDevCommand: npm run dev --prefix frontend`.
4. **npm availability:** node/npm were absent on PATH during planning. Re-check
   before claiming any automated verification result.

## Notes on conventions honored
- `AGENTS.md`/`CODING_STANDARDS.md` read; `docs/adr/` referenced by AGENTS.md does
  NOT exist yet (flagged — no ADR constrains this work beyond the port pattern).
- Follows the `access-bridge.ts` port pattern (isTauri guard → invoke → parse →
  safe fallback) and the `moduleStore.ts` fs-write convention (AppLocalData +
  `@tauri-apps/plugin-fs`). No new libraries; `@tauri-apps/api` 2.12.1 and
  `@tauri-apps/plugin-fs` already present.
