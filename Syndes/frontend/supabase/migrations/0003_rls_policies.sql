-- Migration 0003: Row-Level Security policies — the real access guard.
-- (spec: supabase-database, design "Row-Level Security Policies";
--  Correctness Properties 5 Read scope, 6 Owner-write scope;
--  ADR 0004 administrator-assigned access, ADR 0007 account-scoped learning data)
--
-- The client ships only the anon key, so what the anon key can do is defined
-- ENTIRELY by these policies. The service role bypasses RLS and is SERVER-ONLY,
-- never shipped to the client.
--
-- ADR 0004/0007 CHANGE: signing in never grants access by itself, and the
-- previously-anonymous browse path is CLOSED. A caller must be (a) authenticated
-- AND (b) approved for learning before they can read any published Module. The
-- approval flag is an Administrator-controlled custom claim carried in the JWT's
-- `app_metadata.approved`; end users cannot set it. The anon role gets NO read.
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.3

alter table public.modules enable row level security;

-- ---------------------------------------------------------------------------
-- Claim helper: is the CURRENT caller an approved Account? (ADR 0004/0007)
--
-- Reads `app_metadata.approved` from the verified JWT that Supabase exposes to
-- SQL via `auth.jwt()`. `app_metadata` is writable ONLY by the service role /
-- an Administrator, never by the end user (unlike `user_metadata`), so it is a
-- trustworthy approval signal. Absent/non-true => NOT approved (fail closed).
--
-- STABLE + SECURITY INVOKER (default): it only reads request claims, so it is
-- safe and cacheable within a statement.
-- ---------------------------------------------------------------------------
create or replace function public.is_approved()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'approved')::boolean,
    false
  );
$$;

-- 1. An authenticated, APPROVED caller may READ published modules. (Req 7.1)
--    ADR 0007: closes the former anonymous browse path — anon has no read.
drop policy if exists modules_read_published on public.modules;
create policy modules_read_published
  on public.modules for select
  to authenticated
  using (published = true and public.is_approved());

-- 2. An authenticated teacher may also read their OWN rows (incl. unpublished),
--    once approved. (Req 7.5)
drop policy if exists modules_read_own on public.modules;
create policy modules_read_own
  on public.modules for select
  to authenticated
  using (owner = auth.uid() and public.is_approved());

-- 3. Only an authenticated, approved teacher may INSERT, and only as themselves.
--    (Req 7.3, 9.3) The sealed-shape trigger (0002) still runs and can reject.
drop policy if exists modules_insert_own on public.modules;
create policy modules_insert_own
  on public.modules for insert
  to authenticated
  with check (owner = auth.uid() and public.is_approved());

-- 4. A teacher may UPDATE only their own rows, and the result must stay theirs.
--    (Req 7.4, 9.3)
drop policy if exists modules_update_own on public.modules;
create policy modules_update_own
  on public.modules for update
  to authenticated
  using (owner = auth.uid() and public.is_approved())
  with check (owner = auth.uid() and public.is_approved());

-- 5. A teacher may DELETE only their own rows. (Req 7.4, 9.3)
drop policy if exists modules_delete_own on public.modules;
create policy modules_delete_own
  on public.modules for delete
  to authenticated
  using (owner = auth.uid() and public.is_approved());

-- Req 7.2: no policy grants anon ANY access, and no policy grants anon or an
--          unapproved authenticated caller INSERT/UPDATE/DELETE.
-- Req 7.6 (enforced operationally): service_role bypasses RLS and is SERVER-ONLY,
--          never bundled into the client.
