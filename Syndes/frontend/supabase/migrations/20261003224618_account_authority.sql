-- Current Account authorization lives on the server, independent of stale JWT
-- app_metadata. Only privileged operators can grant approval or Teacher access.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;

create table app_private.account_access (
  account_id uuid primary key references auth.users(id) on delete cascade,
  approved boolean not null default false,
  role text not null default 'Student'
    check (role in ('Student', 'Teacher', 'Administrator')),
  active boolean not null default true
);

alter table app_private.account_access enable row level security;
revoke all on app_private.account_access from public, anon, authenticated;
grant select, insert, update, delete on app_private.account_access to service_role;

-- The bearer JWT supplies identity only. The current row supplies authority.
-- No row means a signed-in Pending Account, which can neither study nor teach.
create function public.current_account_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  access_row app_private.account_access%rowtype;
begin
  if caller_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise insufficient_privilege using message = 'A permanent Account is required';
  end if;
  if not exists (select 1 from auth.users where id = caller_id) then
    raise insufficient_privilege using message = 'Account no longer exists';
  end if;

  select * into access_row
  from app_private.account_access
  where account_id = caller_id;

  return jsonb_build_object(
    'account_id', caller_id,
    'approved', coalesce(access_row.approved, false),
    'role', coalesce(access_row.role, 'Student'),
    'active', coalesce(access_row.active, true)
  );
end;
$$;

revoke all on function public.current_account_access() from public, anon;
grant execute on function public.current_account_access() to authenticated;

-- Keep policy helpers out of the exposed API schema. Their only input is the
-- verified bearer identity, and they read the current row on every request.
create function app_private.can_learn()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app_private.account_access
    where account_id = auth.uid() and active and approved
      and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  );
$$;

create function app_private.can_teach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app_private.account_access
    where account_id = auth.uid()
      and active and role in ('Teacher', 'Administrator')
      and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  );
$$;

revoke all on function app_private.can_learn() from public, anon;
revoke all on function app_private.can_teach() from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.can_learn() to authenticated;
grant execute on function app_private.can_teach() to authenticated;

-- Existing claim-based policies are replaced atomically by this migration.
drop policy if exists modules_read_published on public.modules;
drop policy if exists modules_read_own on public.modules;
drop policy if exists modules_insert_own on public.modules;
drop policy if exists modules_update_own on public.modules;
drop policy if exists modules_delete_own on public.modules;
drop function if exists public.is_approved();

revoke all on public.modules from public, anon, authenticated;
grant select, insert, update, delete on public.modules to authenticated;
grant select, insert, update, delete on public.modules to service_role;
alter table public.modules enable row level security;

create policy modules_read_published on public.modules
  for select to authenticated
  using (published and (select app_private.can_learn()));

create policy modules_read_own on public.modules
  for select to authenticated
  using (owner = (select auth.uid()) and (select app_private.can_teach()));

create policy modules_insert_own on public.modules
  for insert to authenticated
  with check (owner = (select auth.uid()) and (select app_private.can_teach()));

create policy modules_update_own on public.modules
  for update to authenticated
  using (owner = (select auth.uid()) and (select app_private.can_teach()))
  with check (owner = (select auth.uid()) and (select app_private.can_teach()));

create policy modules_delete_own on public.modules
  for delete to authenticated
  using (owner = (select auth.uid()) and (select app_private.can_teach()));
