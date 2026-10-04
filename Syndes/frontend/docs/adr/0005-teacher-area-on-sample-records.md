# Teacher area uses sample class records

Status: proposed for sample class records. The MVP access boundary is implemented; real Learner reporting still needs a separate privacy and access design.

The Teacher area (`/teach`) covers authoring Drafts and reading class records: Learners, Scores, Grades and the Schedule. Learner Results do not reach a Teacher because Progress stays on each Learner's device. Signed-in Teacher and Administrator access is governed by ADR-0004 and ADR-0006.

## Decision

- **Class records and the Schedule come from ports with sample sources.** `features/class-records/class-record-source.ts` and `features/schedule/schedule-source.ts` are the one place each source is chosen, following the `ModuleSource` pattern.
  - The sample data is fictional.
  - Every Teacher page carries a "Sample class data" note (`app/teach/layout.tsx`).
  - Never add real Learner information to `fixture-class-records.ts`.
- **Access is role-based (ADR-0006).** Teacher pages render only for a verified Teacher or Admin, and the Rust core refuses teacher commands from anyone else. The sample records still ship in the client bundle, which is acceptable only because they are fictional. Real records must be read through a teacher-gated Rust command (or a server that checks the Teacher's role) before the sample source is replaced. That boundary also needs a defined purpose, access, retention, deletion and sync policy (security and privacy standard).
- **Drafts are saved in Account-scoped localStorage** on the Teacher's device, including plaintext correct answers. They are hidden from other Accounts in Syndes (ADR-0007). Someone with access to the same operating-system profile can still inspect local files; separate OS logins are required when that confidentiality matters. A Learner Account must never see Drafts.
- **Sealing goes through the `DraftSealer` port**, which maps a Draft to the `DraftModule` shape of `seal_module`. The desktop bridge checks current Teacher access online, seals in Rust, and publishes only the sealed Module through Supabase. A plain browser has no sealing command.
- **The file format can't hold everything a Draft has.** It has no place for a summary, outcomes, lesson minutes or Flashcards. These stay in the Draft. Lessons are flattened into one `lesson.blocks` list, with each Lesson title as a heading.
- **Grades follow DepEd Order No. 8, s. 2015.** That means component weights by learning area group, an initial grade rounded to two decimals, and transmutation where 60 becomes 75. The rules are in `features/class-records/grading.ts`, which has tests.
- **New features:** `authoring`, `class-records` and `schedule`. They don't import from each other or from the learner features. The overview at `/teach` composes them in `app/teach/_components`.

## Consequences

- Replacing the sample sources needs a spec for reporting and syncing. It must cover what leaves a Learner's device, when, and with what consent, plus the authorization boundary above.
- Teach routes and native privileged commands require a fresh online role check; static page code contains no private class data.
- Adding Flashcards or outcomes to the module file is a contract change to spec 00 across all lanes.
