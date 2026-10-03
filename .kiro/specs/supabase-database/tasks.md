# Implementation Plan: Supabase Database (Online Module Store)

## Overview

This plan builds the online-only module store from the data layer up. The SECURITY-CRITICAL
database pieces (schema, the sealed-shape validation trigger, and RLS policies) come first because
they are the backbone of the no-plaintext / contract-valid / access-control guarantees and can be
built and tested with SQL fixtures alone — no frontend required. The client data-access layer
(Supabase client, types, `moduleStore.ts`) comes next and is also buildable now against the live
DB. The UI wiring (browse/catalog screen, pull/publish buttons in the teacher flow) is deferred
per the user and is clearly marked `[FRONTEND — DEFERRED]`; those tasks are listed for completeness
and can be skipped until frontend work resumes.

Lane tags on each top-level group:
- `[DATA LAYER — buildable now]` — pure SQL / server-side, no frontend dependency.
- `[CLIENT DATA-ACCESS — buildable now]` — TS data layer; depends on the DB being migrated.
- `[FRONTEND — DEFERRED]` — React UI; depends on the client data-access layer; skip for now.

Out of scope (do NOT touch): the Rust scoring core, `load_module` / `check_answer` /
`score_submission` / `normalize_answer`, and the offline path (Requirements 2.x, 11.3 — these are
honored by *not* modifying them). No task below changes the Rust core or the offline scoring path.

## Tasks

- [x] 1. Create the `modules` table schema and indexes `[DATA LAYER — buildable now]`
  <!-- Done: supabase/migrations/0001_modules_table.sql -->

  - Author a SQL migration creating `public.modules` exactly as in the design DDL: `id text` PK,
    `data jsonb not null`, metadata columns (`title`, `subject`, `grade_level`, `type`,
    `question_count`, `owner uuid`, `published boolean`), and `created_at` / `updated_at`
    `timestamptz`.
  - Add the browse/list indexes: `modules_published_created_idx`, `modules_subject_idx` (where
    published), `modules_grade_level_idx` (where published), `modules_owner_idx`.
  - Add the `set_updated_at()` function and `modules_set_updated_at` BEFORE UPDATE trigger.
  - _Requirements: 1.1, 1.2, 8.1, 11.6_

- [ ] 2. Server-side sealed-shape validation — the no-plaintext backstop `[DATA LAYER — buildable now]` **HIGH-PRIORITY SECURITY**
  - [x] 2.1 Implement `assert_sealed_module(jsonb)` and the `modules_validate()` trigger
    <!-- Done: supabase/migrations/0002_sealed_shape_validation.sql -->

    - Write `public.assert_sealed_module(data jsonb)` rejecting: `schema_version != "1.0"`; missing
      `module.id` / `module.title`; `module.type` not in (`quiz`,`lesson`); and when a quiz is
      present `hash_algo != "SHA-256"`, `normalization` not exactly
      `"lowercase|trim|collapse-ws|strip-punct"`, empty/non-array `quiz.questions`, any question with
      an unknown `kind`, any question missing/empty `salt` or `answer_hash`, and any question
      carrying a banned plaintext key (`answer`, `correct_answer`, `correctAnswer`, `plaintext`,
      `answer_text`).
    - Write `public.modules_validate()` to `perform assert_sealed_module(new.data)` and then derive
      `id`, `title`, `subject`, `grade_level`, `type`, and `question_count`
      (`coalesce(jsonb_array_length(new.data->'quiz'->'questions'), 0)`) from `data`.
    - Attach `modules_validate_before_write` BEFORE INSERT OR UPDATE so it runs for all roles,
      including the service role.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1, 8.5_
    - **Implements: Correctness Property 2 (Seal-before-store), Property 3 (Contract validity), Property 7 (No draft path)**

  - [ ]* 2.2 Write DB rejection tests — one fixture per violated invariant
    - Each fixture violates exactly one invariant and MUST be rejected by the trigger: missing
      `salt`; missing `answer_hash`; empty `salt`; a plaintext key (`answer`); wrong
      `normalization`; wrong `schema_version`; `hash_algo` not SHA-256; unknown question `kind`;
      empty/non-array `questions`.
    - **Property 2: Seal-before-store — Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - **Property 3: Contract validity — Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**
    - **Property 7: No draft path — Validates: Requirements 3.5, 11.5**

  - [ ]* 2.3 Write DB acceptance + metadata-derivation test
    - Insert `docs/example.module.json` and assert the write succeeds and that `title`, `subject`,
      `grade_level`, `type`, and `question_count` are derived correctly from `data`.
    - **Property 4: Source-of-truth fidelity — Validates: Requirements 8.1, 8.5**

- [ ] 3. Row-Level Security policies `[DATA LAYER — buildable now]` **HIGH-PRIORITY SECURITY**
  - [x] 3.1 Enable RLS and create all five policies exactly as designed
    <!-- Done: supabase/migrations/0003_rls_policies.sql -->

    - `alter table public.modules enable row level security;`
    - `modules_read_published` (SELECT where `published = true`); `modules_read_own` (authenticated
      SELECT where `owner = auth.uid()`); `modules_insert_own` (authenticated INSERT with check
      `owner = auth.uid()`); `modules_update_own` (authenticated UPDATE using + with check
      `owner = auth.uid()`); `modules_delete_own` (authenticated DELETE using `owner = auth.uid()`).
    - No policy grants anon INSERT/UPDATE/DELETE, so the anon key is read-only.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.3_
    - **Implements: Correctness Property 5 (Read scope), Property 6 (Owner-write scope)**

  - [ ]* 3.2 Write RLS tests — anon client vs authenticated client
    - Anon client: CAN SELECT published rows; CANNOT SELECT unpublished rows; CANNOT INSERT/UPDATE/
      DELETE.
    - Authenticated teacher client: CAN SELECT own + published; CAN INSERT only with
      `owner = auth.uid()`; CAN UPDATE/DELETE only own rows; CANNOT write rows owned by another uid.
    - **Property 5: Read scope — Validates: Requirements 7.1, 7.2**
    - **Property 6: Owner-write scope — Validates: Requirements 7.3, 7.4**

- [ ] 4. Checkpoint — database layer
  - Ensure all DB (trigger + RLS) tests pass, ask the user if questions arise. This is the
    security backbone; do not proceed to the client layer until it is green.

- [ ] 5. Client env + Supabase client (anon key only) `[CLIENT DATA-ACCESS — buildable now]` **SECURITY**
  - [x] 5.1 Create `supabase.ts` using the anon key only
    <!-- Done: src/lib/supabase.ts (anon key only, bracket env access); frontend/.env.example + .gitignore !.env.example -->

    - Instantiate the client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
    - Ensure the service role key is NEVER imported/referenced in client code and the
      `GROQ_API_KEY` stays server-side; add `.env.example` entries and confirm no privileged secret
      is reachable from the client bundle (`NEXT_PUBLIC_*` only on the client).
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 7.6_

- [ ] 6. Types + data-access layer `[CLIENT DATA-ACCESS — buildable now]`
  - [x] 6.1 Create `types.ts` with the sealed contract types
    <!-- Done: src/lib/types.ts (tsc-clean; type gate verified to reject plaintext DraftModule) -->

    - Define `QuestionKind`, `SealedQuestion` (with `salt` + `answer_hash`, deliberately NO `answer`/
      plaintext field), `Module`, `ModuleSummary`, and `ListFilter` exactly as in the design.
    - _Requirements: 1.5, 3.5_

  - [x] 6.2 Implement `publishModule(sealed: Module)` in `moduleStore.ts`
    <!-- Done: src/lib/moduleStore.ts -->

    - Accept only the sealed `Module` type (a `DraftModule` must not type-check as an argument);
      resolve the signed-in teacher via `supabase.auth.getUser()`; INSERT
      `{ data: sealed, owner, published: true }`; surface trigger rejections as thrown errors.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 3.5, 9.1_

  - [x] 6.3 Implement `listModules(filter?)` in `moduleStore.ts`
    <!-- Done: src/lib/moduleStore.ts -->

    - SELECT lightweight metadata columns for `published = true` rows, ordered by `created_at desc`;
      apply optional `subject` eq, `grade_level` eq, and `title` ilike search; map `created_at` to
      `published_at` in the returned `ModuleSummary[]`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 6.4 Implement `getModule(id)` and `pullModule(id)` in `moduleStore.ts`
    <!-- Done: src/lib/moduleStore.ts (pullModule writes AppLocalData then invoke load_module) -->

    - `getModule(id)` fetches the full `data` JSONB (the exact bytes `load_module` consumes).
    - `pullModule(id)` fetches via `getModule`, writes the JSON to `modules/{id}.json` under
      `AppLocalData` via the Tauri fs plugin, then hands off to the EXISTING `load_module` Tauri
      command. Do not modify `load_module` or the Rust core.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 12.3_

  - [ ]* 6.5 Write store round-trip property test (`fast-check`)
    - For any sealed Module valid against `module.schema.json`, `publishModule` -> `getModule`
      round-trips `data` byte-for-byte with no transformation.
    - **Property 4: Source-of-truth fidelity — Validates: Requirements 8.2, 8.3, 8.4**

  - [ ]* 6.6 Write pull → offline integration test (network disabled)
    - With the network disabled, prove `pullModule` writes local JSON and that a subsequently
      scored pulled module yields the SAME verdict/points as a locally-authored module with
      identical `question_id`/`salt`/`answer_hash` — confirming Supabase is never in the scoring
      path.
    - **Property 1: Offline isolation — Validates: Requirements 2.1, 2.2, 2.6, 6.4**
    - **Property 8: Client-side sealing / no plaintext in transit — Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 7. Client-side sealing wiring `[CLIENT DATA-ACCESS — buildable now]` **SECURITY**
  - [ ] 7.1 Wire the publish path through the existing Rust core seal step
    - Ensure the publish path seals via the existing Rust core (`seal_module` / seal step) BEFORE
      calling `publishModule`, so only a sealed `Module` reaches the store and the plaintext answer
      never crosses a network boundary. The draft (plaintext) exists only in local memory.
    - Support offline create+seal+local-save: a teacher can create and seal a module and save it
      locally with no connection; publishing to Supabase defers until a connection is available.
      Do not modify the Rust seal implementation itself — only call it.
    - _Requirements: 12.1, 12.2, 12.4, 12.5_
    - **Implements: Correctness Property 8 (Client-side sealing / no plaintext in transit)**

  - [ ]* 7.2 Write no-plaintext-in-transit test for the publish path
    - Assert the object handed to `publishModule`/INSERT carries only `salt` + `answer_hash` per
      question and no banned plaintext key, and that no draft/plaintext payload is sent over the
      wire.
    - **Property 8: Client-side sealing / no plaintext in transit — Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 8. Checkpoint — client data-access layer
  - Ensure all client data-access and sealing-wiring tests pass, ask the user if questions arise.
    After this point the store is fully usable from code; only the UI remains.

- [ ] 9. UI wiring `[FRONTEND — DEFERRED]` (listed for completeness; skip until frontend work resumes)
  - [ ] 9.1 Build the browse/catalog screen
    - Render `ModuleSummary[]` from `listModules`, with subject/grade_level filters and a title
      search box; newest-first order.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 9.2 Wire the pull action from a catalog entry
    - A "pull/download" control that calls `pullModule(id)` and then renders the loaded module via
      the existing lesson/quiz UI. Scoring remains the unchanged offline path.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 9.3 Wire the publish action in the teacher flow
    - A teacher-side "publish" control that runs the seal step (task 7.1) and calls
      `publishModule`; surface trigger-rejection errors inline. Include honest, tamper-resistant
      copy (no "cryptographically secret" / "cheat-proof" claims).
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 12.6_

- [ ] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP, but the
  DB-layer tests (2.2, 2.3, 3.2) are strongly recommended since they guard the security backbone.
- Lane tags identify what is buildable now (DATA LAYER, CLIENT DATA-ACCESS) vs deferred (FRONTEND).
- Security-critical DB work (sealed-shape trigger, RLS) is the earliest substantive work (tasks 2
  and 3) and is buildable/testable with SQL fixtures alone — no frontend needed.
- Every task traces to specific requirements; property tests cite the design's Correctness Properties.
- No task modifies the Rust scoring core or the offline path (Requirements 2.x, 11.3 are honored by
  leaving them untouched).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["6.2"] },
    { "id": 5, "tasks": ["6.3"] },
    { "id": 6, "tasks": ["6.4"] },
    { "id": 7, "tasks": ["7.1", "6.5", "6.6"] },
    { "id": 8, "tasks": ["7.2", "9.1", "9.2", "9.3"] }
  ]
}
```
