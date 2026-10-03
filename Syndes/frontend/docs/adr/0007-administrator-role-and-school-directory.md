# Administrator role and school directory

Status: proposed. Needs maintainer review because it changes who can do what.

ADR-0004 (accepted) says an Administrator assigns Teacher access and that signing in never grants it. This ADR covers the screens that do that, the data behind them, and how the three roles relate.

## Decision

**Roles are separate, not nested.**
- Learn is open to every role.
- Teach is for a verified Teacher only.
- Administration (`/admin`) is for a verified Administrator only.
- An Administrator is not a Teacher. This replaces ADR-0006's "Admin counts as a Teacher" in the webview (`canTeach`, `canAdminister`) and in the Rust core (`is_teacher_access` now requires `Role::Teacher`). It also matches the glossary, which keeps the two apart.

**What an Administrator does:**
- Give and remove Teacher access, then assign each Teacher to Classes. A Class has at most one current Teacher.
- Enroll a Learner in a Section, move them, or remove them with a required reason (dropped or transferred out). The reason feeds the drop rate.
- Remove all access for an account, and restore it later. A restored account gets Learn only.
- Create Sections and add learning-area Classes to them.
- Read school statistics per grading period, each with the time it was counted: enrolled, passing rate, failing rate and drop rate. Rates are always computed from stored counts.
- Read an append-only activity log of every change, with who made it and when.

**Guard rails:**
- New sign-ins wait in "Waiting for access" until an Administrator places them.
- An Administrator can't remove their own access or another Administrator's; the system owner changes Administrator access.
- An enrolled Learner must leave their Section, with a reason, before their account can be removed or given Teacher access.

**Enforcement is in Supabase** (`supabase/migrations/0004_school_access.sql`).
- Clients get read-only RLS. A Teacher reads only Learners in Sections they teach, and a Learner reads only their own rows.
- Every change goes through an `admin_*` SECURITY DEFINER function. Each one calls `require_admin()` first, which reads the caller's current role from `profiles`, not from the token. That is ADR-0004's online check: removing access takes effect at once.
- `features/school-directory/directory-actions.ts` holds the same rules as pure functions, so screens can explain a refusal before anything is sent.

**Sample mode until the directory is connected.**
- `AdminGuard` follows the core's `auth_resolve_role`, the same way `TeachGuard` does.
- The directory is a fictional school. Changes are kept in localStorage (`syndes:directory-sample:v1`) and can be reset.
- Statistics are fictional snapshots.
- Every Administrator page says this.
- The sample Directory imports the Teacher area's sample Learners so both roles see one school. This is the only cross-feature import, and it goes away with the fixtures.

## Consequences

- Connecting the real directory means:
  - a Supabase sign-in flow;
  - replacing `use-directory.ts` with RPC calls to the `admin_*` functions and RLS reads;
  - replacing the statistics source with `school_statistics_snapshots`.

  The Teacher area's class records should then be read through the same RLS (`teaches_learner`).
- The migration hasn't been run, and its SQL tests haven't been written.
- `modules` RLS (migration 0003) still lets any signed-in account write its own rows. It should require `current_app_role() = 'teacher'` now that roles exist.
- Supabase reserves the JWT `role` claim for its Postgres role, while SPEC B expects the app role in `role`. The access-token hook needs a decision, for example a separate `app_role` claim, before the Rust core can verify Administrators offline.
