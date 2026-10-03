-- Migration 0003: Row-Level Security policies — the real access guard.
-- (spec: supabase-database, design "Row-Level Security Policies";
--  Correctness Properties 5 Read scope, 6 Owner-write scope)
--
-- The client ships only the anon key, so what the anon key can do is defined
-- ENTIRELY by these policies. The service role bypasses RLS and is SERVER-ONLY,
-- never shipped to the client. No policy grants anon INSERT/UPDATE/DELETE, so the
-- anon key is strictly read-only on published rows.
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.3

alter table public.modules enable row level security;

-- 1. Public (anon + authenticated) may READ only published modules. (Req 7.1)
--    Powers browse & pull for any online device without a login.
drop policy if exists modules_read_published on public.modules;
create policy modules_read_published
  on public.modules for select
  using (published = true);

-- 2. An authenticated teacher may also read their OWN rows (incl. unpublished). (Req 7.5)
drop policy if exists modules_read_own on public.modules;
create policy modules_read_own
  on public.modules for select
  to authenticated
  using (owner = auth.uid());

-- 3. Only an authenticated teacher may INSERT, and only as themselves. (Req 7.3, 9.3)
--    The sealed-shape trigger (0002) still runs and can reject the row.
drop policy if exists modules_insert_own on public.modules;
create policy modules_insert_own
  on public.modules for insert
  to authenticated
  with check (owner = auth.uid());

-- 4. A teacher may UPDATE only their own rows, and the result must stay theirs. (Req 7.4, 9.3)
drop policy if exists modules_update_own on public.modules;
create policy modules_update_own
  on public.modules for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- 5. A teacher may DELETE only their own rows. (Req 7.4, 9.3)
drop policy if exists modules_delete_own on public.modules;
create policy modules_delete_own
  on public.modules for delete
  to authenticated
  using (owner = auth.uid());

-- Req 7.2: no policy grants anon INSERT/UPDATE/DELETE -> the anon key cannot write.
-- Req 7.6 (enforced operationally): service_role bypasses RLS and is SERVER-ONLY,
--          never bundled into the client.
