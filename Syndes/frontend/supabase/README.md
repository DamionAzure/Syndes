# Supabase — online module store (spec: `supabase-database`)

The online-only store for **already-sealed** modules. The offline scoring path
(Rust core) never touches this; the only online→offline bridge is `pullModule`
(see `src/lib/moduleStore.ts`), which ends by handing a local file to the
existing `load_module` Tauri command.

## Files

- `migrations/0001_modules_table.sql` — the `modules` table (JSONB `data` source
  of truth + derived metadata columns + indexes + `updated_at` trigger).
- `migrations/0002_sealed_shape_validation.sql` — **the no-plaintext backstop.**
  `assert_sealed_module()` + a BEFORE INSERT/UPDATE trigger that rejects any
  unsealed/plaintext/contract-invalid write for ALL roles (service role included),
  and derives the metadata columns from `data`.
- `migrations/0003_rls_policies.sql` — Row-Level Security: anon reads only
  `published` rows and cannot write; authenticated teachers write only their own
  rows (`owner = auth.uid()`).
- `migrations/0004_school_access.sql` — the school directory and
  Administrator-assigned access (ADR-0004, ADR-0007): `profiles` with
  `app_role` (every sign-in starts as `student`), sections, classes, teacher
  assignments, enrollments, period results, statistics snapshots and an
  append-only `access_events` log. Clients get read-only RLS; every access
  change goes through an `admin_*` SECURITY DEFINER function that re-checks the
  caller's current role. Not yet executed; it has no SQL tests yet.
- `tests/0001_sealed_shape_and_rls.test.sql` — DB tests: acceptance + metadata
  derivation, one-invariant-per-fixture rejections, and RLS-enabled smoke checks.

## Apply + test (requires the Supabase CLI + Docker, OR a live project)

Local (CLI + Docker):

```bash
# from Syndes/frontend
supabase start                 # boots local Postgres
supabase db reset              # applies migrations/ in order
psql "$DATABASE_URL" -f supabase/tests/0001_sealed_shape_and_rls.test.sql
# a clean run (only NOTICE "ok:" lines, no exceptions) == all tests passed
```

Live project (SQL editor): paste `0001` → `0002` → `0003` in order, then paste
the test file. Any `TEST FAILED` / `module rejected` exception on the test file's
acceptance block indicates a problem; the rejection fixtures are *expected* to be
rejected.

## Client config

Set in `frontend/.env.local` (see `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The **anon key only** goes in the client — RLS is the real guard. The Supabase
service role key and `GROQ_API_KEY` are server-side secrets and must never be put
in a `NEXT_PUBLIC_*` var.

## Status

Authored and type-checked (client layer via `tsc`). The SQL migrations and SQL
tests are **not yet executed** here because no Supabase CLI/Docker instance was
available at authoring time — run the steps above against an instance to verify.
