# Requirements Document

## Introduction

Supabase (hosted Postgres) is Acassist's **online-only module store** for already-sealed,
contract-valid modules. It sits beside the teacher side and is never part of the student scoring
path. Teachers publish sealed modules to a single `modules` table; any online device can browse
summaries and pull a full module; once pulled, the module is a plain JSON file on local disk that
is scored entirely offline by the unchanged Rust core (specs 01 and 04).

These requirements are **derived from** the approved design (`.kiro/specs/supabase-database/design.md`),
which is the source of truth. They are written so the design already satisfies them, and so the
design's seven Correctness Properties can cite specific acceptance criteria. They preserve five hard
invariants carried over from specs 00 (module contract), 01 (command boundary), 03 (teacher lane),
and 04 (Rust core): the offline scoring path is untouched and makes no network calls; only sealed
modules (salt + answer_hash, no plaintext) are ever stored; stored modules are contract-valid against
`module.schema.json`; the store is online-only teacher-side infrastructure that the demo's offline
path never depends on; and sealing is client-side in the Rust core on the teacher's own device — the
plaintext answer never crosses the network boundary, so the honest claim is tamper-resistant (not
cryptographically unbreakable).

The scope is the online store, its access control, and the single online→offline bridge (pull).
Explicit non-goals are listed in Requirement 11.

## Glossary

- **modules table**: The single Postgres table `public.modules` that stores each sealed module. Keyed
  by `module.id`. Holds the sealed Module JSON in a `data` JSONB column plus derived metadata columns.
- **sealed Module** (**Module**): A contract-valid module in which every question carries only `salt`
  and `answer_hash` and no plaintext answer field. This is the shape the Rust core produces after its
  seal step and the only shape the store accepts.
- **DraftModule**: An in-memory teacher-side module that still carries plaintext answers. It exists
  only during generation/sealing and is never stored, transmitted to, or accepted by the store.
- **data (JSONB)**: The `data jsonb` column holding the exact sealed Module bytes. The single source
  of truth that `load_module` consumes unchanged.
- **metadata columns**: `title`, `subject`, `grade_level`, `type`, `question_count` — a server-derived
  projection of `data` used for browse/list. Never authoritative over `data`.
- **ModuleSummary**: A lightweight browse record (`id`, `title`, `subject`, `grade_level`, `type`,
  `question_count`, `published_at`) returned by list queries without downloading full JSON.
- **published**: A boolean column; only rows where `published = true` are publicly readable.
- **owner**: A `uuid` column referencing the authenticated teacher (`auth.uid()`) who published a row;
  drives owner-write access control.
- **RLS**: Row-Level Security — the Postgres policy mechanism that is the real access guard for the
  store.
- **anon key**: The public Supabase key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) shipped in the client. Safe
  to ship because RLS defines everything it can do.
- **service role**: The privileged Supabase key that bypasses RLS. Server-only, never shipped to the
  client.
- **sealed-shape trigger**: The `BEFORE INSERT OR UPDATE` database trigger (`modules_validate` /
  `assert_sealed_module`) that rejects any non-sealed or non-contract-valid write for all roles.
- **Student_Path**: The offline scoring path — `load_module`, `check_answer`, `score_submission`,
  `normalize_answer` — compiled in the Rust core, making no network calls.
- **Teacher_Path**: The online lane where teachers generate, seal, and publish modules.
- **pull**: The single online→offline bridge: fetch sealed JSON, write it to local disk, hand off to
  `load_module`.
- **GROQ_API_KEY**: The server-side key used by Groq generation; never bundled into the client.

## Requirements

### Requirement 1: Publish sealed modules to the online store

**User Story:** As a teacher, I want to publish an already-sealed, contract-valid module to the online
store, so that other online devices can discover and download it.

#### Acceptance Criteria

1. WHEN a teacher publishes a sealed Module, THE modules_table SHALL store the sealed Module JSON in
   the `data` JSONB column keyed by the value of `data.module.id`.
2. THE modules_table SHALL treat the `data` JSONB column as the source of truth for the stored module.
3. WHEN a teacher publishes a sealed Module, THE Teacher_Path SHALL set `published = true` on the
   stored row.
4. WHEN a teacher publishes a sealed Module, THE Teacher_Path SHALL set `owner` to the publishing
   teacher's `auth.uid()`.
5. THE Teacher_Path SHALL accept only the sealed Module type as the publish argument and SHALL reject
   a DraftModule at the client type boundary.

### Requirement 2: Offline path isolation (hard invariant)

**User Story:** As a student using the app without a connection, I want scoring to work entirely on my
device, so that network availability never affects whether I can be scored.

#### Acceptance Criteria

1. WHEN any Student_Path operation (load_module, check_answer, score_submission, normalize_answer) executes, THE Student_Path SHALL complete that operation while issuing zero network requests of any kind (DNS, TCP, HTTP, or socket).
2. WHEN any Student_Path operation (load_module, check_answer, score_submission, normalize_answer) executes, THE Student_Path SHALL reference no Supabase client, no Supabase SDK symbol, and no modules_table accessor at compile time or runtime.
3. WHEN a module obtained via pull (fetch sealed JSON then write local file then load_module) is scored, THE Student_Path SHALL return a CheckResult with the same correct verdict and the same points value, and a ScoreResult with the same correct_count, total_count, points_earned, and points_possible values, as a locally-authored module containing identical question_id, salt, and answer_hash fields scored with identical raw answers.
4. WHILE the device reports no network connection, WHEN a Student_Path operation is invoked on a locally-held module, THE Student_Path SHALL return a successful Result (Ok) carrying the scoring outcome rather than a network-related failure.
5. IF a Student_Path operation cannot resolve a required input locally (missing module file, missing salt, or missing answer_hash), THEN THE Student_Path SHALL return a typed AppError identifying the missing input, SHALL make no network request to recover it, and SHALL leave any already-computed per-question results unmodified.
6. THE modules_table SHALL NOT be a runtime or compile-time dependency of any Student_Path operation (load_module, check_answer, score_submission, normalize_answer).

### Requirement 3: No plaintext answers at the database layer (hard invariant)

**User Story:** As a security-conscious maintainer, I want the store to be structurally incapable of
holding plaintext answers, so that answer keys never leak through the database layer (spec 00 R2 /
spec 03 R2).

#### Acceptance Criteria

1. THE modules_table SHALL store only sealed Modules in which every question object carries a salt string of length greater than or equal to 1 character and an answer_hash string of length greater than or equal to 1 character.
2. IF an INSERT or UPDATE presents a Module in which any question object omits the salt key, contains an empty salt, omits the answer_hash key, or contains an empty answer_hash, THEN THE sealed-shape trigger SHALL raise an exception, reject the write, and persist no row, and the write-initiating caller SHALL receive an error indication identifying the sealed-shape violation.
3. IF an INSERT or UPDATE presents a Module in which any question object carries any of the banned plaintext-answer keys (answer, correct_answer, correctAnswer, plaintext, answer_text), THEN THE sealed-shape trigger SHALL raise an exception, reject the write, and persist no row, and the write-initiating caller SHALL receive an error indication identifying the plaintext-answer-key violation.
4. WHEN any INSERT or UPDATE is issued against the modules_table by any role, including the service role, THE sealed-shape trigger SHALL execute the sealed-shape check before the row is written and SHALL apply the identical acceptance and rejection outcomes defined in criteria 1 through 3 regardless of the issuing role.
5. THE Teacher_Path SHALL accept only the sealed Module type at the client such that no code path submits a DraftModule to the modules_table, and THE modules_table SHALL reject any write that is not a sealed Module via the server-side sealed-shape trigger as defined in criteria 2 and 3.

### Requirement 4: Contract validity of stored modules

**User Story:** As a maintainer, I want every stored module to match the module contract, so that
`load_module` can consume any pulled module without special-casing (spec 00).

#### Acceptance Criteria

1. IF a write presents `data.schema_version` not equal to `"1.0"`, THEN THE sealed-shape trigger SHALL
   reject the write.
2. IF a write presents a `data.module` envelope missing a non-empty `id`, a non-empty `title`, or a
   `type` that is not `quiz` or `lesson`, THEN THE sealed-shape trigger SHALL reject the write.
3. WHERE a quiz is present, IF `data.quiz.hash_algo` is not `"SHA-256"`, THEN THE sealed-shape trigger
   SHALL reject the write.
4. WHERE a quiz is present, IF `data.quiz.normalization` is not exactly
   `"lowercase|trim|collapse-ws|strip-punct"`, THEN THE sealed-shape trigger SHALL reject the write.
5. WHERE a quiz is present, IF `data.quiz.questions` is not a non-empty array, THEN THE sealed-shape
   trigger SHALL reject the write.
6. IF a write presents a question whose `kind` is not one of `multiple_choice`, `identification`, or
   `true_false`, THEN THE sealed-shape trigger SHALL reject the write.

### Requirement 5: Browse / list published modules

**User Story:** As an online user, I want to browse a catalog of published modules filtered and sorted,
so that I can find a module without downloading full JSON for every entry.

#### Acceptance Criteria

1. WHEN an online device lists modules using the anon key, THE modules_table SHALL return only rows
   where `published = true`.
2. WHEN listing modules, THE modules_table SHALL return ModuleSummary records containing lightweight
   metadata only and SHALL NOT require downloading full module JSON.
3. WHERE a subject filter is supplied, THE modules_table SHALL return only summaries whose `subject`
   matches the filter.
4. WHERE a grade_level filter is supplied, THE modules_table SHALL return only summaries whose
   `grade_level` matches the filter.
5. WHERE a title search term is supplied, THE modules_table SHALL return only summaries whose `title`
   contains the search term.
6. WHEN listing modules, THE modules_table SHALL order results by `created_at` descending
   (newest-first).

### Requirement 6: Pull / download a module to local disk

**User Story:** As an online user, I want to pull a published module to my device, so that from then on
it behaves like any locally-held module and scores offline.

#### Acceptance Criteria

1. WHEN a user pulls a module by id, THE pull SHALL fetch the full sealed Module JSON from the `data`
   column via `getModule(id)`.
2. WHEN the sealed JSON is fetched, THE pull SHALL write it to a local path on disk.
3. WHEN the sealed JSON is written to disk, THE pull SHALL hand the file off to the existing
   `load_module` Tauri command.
4. WHEN `load_module` has loaded a pulled module, THE Student_Path SHALL treat and score it identically
   to any locally-held module.
5. THE pull SHALL be the only path that moves a module from the online store to the offline device.

### Requirement 7: Row-Level Security access control

**User Story:** As a maintainer, I want RLS to be the real access guard, so that shipping the anon key
is safe and only teachers can write.

#### Acceptance Criteria

1. WHEN a request uses the anon key, THE RLS SHALL permit SELECT only on rows where `published = true`.
2. WHEN a request uses the anon key, THE RLS SHALL deny INSERT, UPDATE, and DELETE.
3. WHEN an authenticated teacher inserts a row, THE RLS SHALL permit the insert only where
   `owner = auth.uid()`.
4. WHEN an authenticated teacher updates or deletes a row, THE RLS SHALL permit the operation only on
   rows where `owner = auth.uid()`.
5. WHERE a request is authenticated, THE RLS SHALL permit a teacher to SELECT their own rows in
   addition to published rows.
6. THE service role SHALL remain server-only and SHALL NOT be shipped to the client.

### Requirement 8: Metadata projection fidelity

**User Story:** As a maintainer, I want metadata columns to be a faithful projection of `data`, so that
browse is fast while `data` remains the single source of truth.

#### Acceptance Criteria

1. WHEN a row is written, THE sealed-shape trigger SHALL derive `title`, `subject`, `grade_level`,
   `type`, and `question_count` from `data` server-side.
2. THE metadata columns SHALL NOT be authoritative over `data`.
3. WHEN a module is fetched by id, THE modules_table SHALL return in `getModule(id).data` the exact
   bytes that `load_module` consumes.
4. WHEN a sealed Module is published and then fetched, THE modules_table SHALL round-trip the `data`
   bytes without transformation.
5. WHEN deriving `question_count`, THE sealed-shape trigger SHALL set it to the length of
   `data.quiz.questions`, or `0` when no quiz is present.

### Requirement 9: Teacher identity

**User Story:** As a maintainer, I want teacher ownership tied to Supabase Auth, so that owner-write
policies have a real identity while students stay account-free.

#### Acceptance Criteria

1. WHEN a teacher publishes a module, THE Teacher_Path SHALL identify the teacher via Supabase Auth
   `auth.uid()` and record it as the row `owner`.
2. THE Student_Path SHALL NOT require any student authentication to browse, pull, or score modules.
3. WHERE multiple teachers exist, THE RLS SHALL scope writes to each teacher's own rows via
   `owner = auth.uid()`.

### Requirement 10: Keys and security

**User Story:** As a maintainer, I want client-side and server-side keys clearly separated, so that no
privileged secret is ever bundled into the client.

#### Acceptance Criteria

1. THE client SHALL use the anon key supplied via `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. THE service role key SHALL remain in server-side `.env` and SHALL NOT be bundled into the client.
3. THE GROQ_API_KEY SHALL remain in server-side `.env` and SHALL NOT be bundled into the client.
4. THE anon key SHALL be safe to ship because RLS defines the full set of operations it can perform.

### Requirement 11: Scope boundaries (non-goals)

**User Story:** As a maintainer, I want the store's boundaries stated explicitly, so that out-of-scope
work is not accidentally built into this layer.

#### Acceptance Criteria

1. THE modules_table SHALL NOT store results or analytics data; a results/attempts table is roadmap and
   is out of scope for this layer.
2. THE store SHALL NOT provide realtime sync or subscriptions beyond simple pull-on-demand.
3. THE Student_Path and the Rust scoring core SHALL remain unchanged by this layer.
4. THE store SHALL NOT provide student accounts or student login.
5. THE store SHALL NOT provide any table, column, or endpoint that accepts or stores a DraftModule or a
   plaintext answer.
6. THE modules_table SHALL use Postgres (Supabase) with a JSONB `data` column and SHALL NOT split
   module JSON into external blob storage; external blob storage is roadmap only for future large
   media (lesson images or video) as a pointer-in-Postgres pattern and SHALL NOT hold module JSON or
   any content bearing answers.

### Requirement 12: Client-side sealing and honest security framing (thesis conformance)

**User Story:** As a security-conscious maintainer, I want sealing to be performed only by the Rust
core on the teacher's own device with the plaintext answer never crossing the network, so that the
store conforms to the project's honest "tamper-resistant, not cryptographically unbreakable" claim and
never over-states what Supabase provides.

#### Acceptance Criteria

1. WHEN a module is sealed, THE Teacher_Path SHALL perform sealing only via the compiled Rust core on
   the client teacher device, and no server-side sealing path SHALL exist.
2. WHILE a module is being authored or sealed, THE DraftModule plaintext answer SHALL exist only in
   local device memory and SHALL NOT be transmitted over any network boundary, including to Supabase
   or to any server.
3. WHEN a module is published or stored, THE modules_table SHALL hold only the sealed Module
   (salt + answer_hash, no plaintext) and SHALL NOT hold any plaintext answer.
4. WHERE the device reports no network connection, THE Teacher_Path SHALL allow a teacher to create and
   seal a module and save it locally, and local creation and sealing SHALL NOT be blocked by the
   absence of a connection; publishing to Supabase MAY occur later when a connection is available.
5. WHEN the Supabase layer is present, THE Student_Path SHALL retain the unchanged offline scoring path
   and the compiled-in tamper-resistance claim defined in Requirement 2, and the Supabase layer SHALL
   NOT alter that path or claim.
6. THE requirements wording and any derived UI copy SHALL describe the module as tamper-resistant with
   no plaintext in storage or transit, consistent with specs 00 and 04, and SHALL NOT claim that the
   stored or transmitted module keeps answers cryptographically secret or is cheat-proof.
