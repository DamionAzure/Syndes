# Administrator role and school directory

Status: proposed. Needs maintainer review because it changes who can do what and introduces a second Account authority model.

The accepted ADR-0004 currently lets Administrators use Teacher screens and commands. The proposed separate-role rule below is **not active**. The school directory screens currently use fictional local sample data. Its SQL is retained at `supabase/proposals/school_access.sql`, outside the automatic migration path, until it is reconciled with `app_private.account_access` and the accepted online authorization contract.

ADR-0004 (accepted) says an Administrator assigns Teacher access and that signing in never grants it. This ADR covers the screens that do that, the data behind them, and how the three roles relate.

## Proposed decision

**Roles are separate, not nested.**
- Learning remains subject to Account approval for every role (ADR-0004).
- Teach is for a verified Teacher only.
- Administration (`/admin`) is for a verified Administrator only.
- An Administrator would no longer use Teacher screens. This would change ADR-0004 and ADR-0006 and requires a maintainer decision before implementation.

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

**Proposed enforcement is in Supabase** (`supabase/proposals/school_access.sql`). This SQL is not deployable with the current Account authority migration.
- Clients get read-only RLS. A Teacher reads only Learners in Sections they teach, and a Learner reads only their own rows.
- The draft SQL routes changes through `admin_*` functions, but its `profiles` role check must be replaced with the accepted current Account authority before use.
- `features/school-directory/directory-actions.ts` holds the same rules as pure functions, so screens can explain a refusal before anything is sent.

**Sample mode until the directory is connected.**
- `AdminGuard` follows the core's `auth_resolve_role`, the same way `TeachGuard` does.
- The directory is a fictional school. Changes are kept in localStorage (`syndes:directory-sample:v1`) and can be reset.
- Statistics are fictional snapshots.
- Every Administrator page says this.
- The sample Directory imports the Teacher area's sample Learners so both roles see one school. This is the only cross-feature import, and it goes away with the fixtures.

## Consequences

- Connecting the real directory means:
  - using the existing Supabase sign-in and current Account authority;
  - replacing `use-directory.ts` with RPC calls to the `admin_*` functions and RLS reads;
  - replacing the statistics source with `school_statistics_snapshots`.

  The Teacher area's class records should then be read through the same RLS (`teaches_learner`).
- The proposed SQL has not been run or tested and must not be applied as a migration in its present form.
- Module RLS and Rust authorization use the current Account RPC. The directory design must use that same authority, including its online requirement for privileged actions.
