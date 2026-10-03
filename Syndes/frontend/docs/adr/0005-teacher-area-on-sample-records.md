# Teacher area ships on sample records, with no access control yet

Status: proposed. The security and privacy points need maintainer approval before any real Learner data is used.

The Teacher area (`/teach`) covers authoring Drafts and reading class records: Learners, Scores, Grades and the Schedule. Two things it needs don't exist yet. The first is a way for Learner Results to reach a Teacher, since Progress stays on each Learner's device. The second is any notion of who is signed in.

## Decision

- **Class records and the Schedule come from ports with sample sources.** `features/class-records/class-record-source.ts` and `features/schedule/schedule-source.ts` are the one place each source is chosen, following the `ModuleSource` pattern.
  - The sample data is fictional.
  - Every Teacher page carries a "Sample class data" note (`app/teach/layout.tsx`).
  - Never add real Learner information to `fixture-class-records.ts`.
- **Access is role-based (ADR-0006).** Teacher pages render only for a verified Teacher or Admin, and the Rust core refuses teacher commands from anyone else. The sample records still ship in the client bundle, which is acceptable only because they are fictional. Real records must be read through a teacher-gated Rust command (or a server that checks the Teacher's role) before the sample source is replaced. That boundary also needs a defined purpose, access, retention, deletion and sync policy (security and privacy standard).
- **Drafts are saved in localStorage on the Teacher's device** under `syndes:teacher-drafts:v1`, including plaintext correct answers. This is needed to keep work between sessions. It also means anyone using the same device profile can read those answers. A Learner device must never hold Drafts.
- **Sealing goes through the `DraftSealer` port**, which maps a Draft to the `DraftModule` shape of `seal_module`. Until the Tauri bridge lands, the port reports `unsupported` and nothing is sealed in the browser.
- **The file format can't hold everything a Draft has.** It has no place for a summary, outcomes, lesson minutes or Flashcards. These stay in the Draft. Lessons are flattened into one `lesson.blocks` list, with each Lesson title as a heading.
- **Grades follow DepEd Order No. 8, s. 2015.** That means component weights by learning area group, an initial grade rounded to two decimals, and transmutation where 60 becomes 75. The rules are in `features/class-records/grading.ts`, which has tests.
- **New features:** `authoring`, `class-records` and `schedule`. They don't import from each other or from the learner features. The overview at `/teach` composes them in `app/teach/_components`.

## Consequences

- Replacing the sample sources needs a spec for reporting and syncing. It must cover what leaves a Learner's device, when, and with what consent, plus the authorization boundary above.
- Once roles exist, the Teach routes should move behind them, and a Learner build should leave them out.
- Adding Flashcards or outcomes to the module file is a contract change to spec 00 across all lanes.
