-- Account authorization at the authenticated SQL role boundary.
-- Run after migrations; the transaction leaves no test Accounts or Modules.
begin;

insert into auth.users (id, aud, role, email)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'syndes-student@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'syndes-teacher-a@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'syndes-teacher-b@example.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'syndes-pending@example.invalid');

insert into app_private.account_access (account_id, approved, role, active)
values
  ('10000000-0000-4000-8000-000000000001', true, 'Student', true),
  ('10000000-0000-4000-8000-000000000002', false, 'Teacher', true),
  ('10000000-0000-4000-8000-000000000003', true, 'Teacher', true);

insert into public.modules (data, owner, published)
values
  ('{"schema_version":"1.0","module":{"id":"authority-published","type":"lesson","title":"Published"}}', '10000000-0000-4000-8000-000000000002', true),
  ('{"schema_version":"1.0","module":{"id":"authority-unpublished-a","type":"lesson","title":"Unpublished A"}}', '10000000-0000-4000-8000-000000000002', false),
  ('{"schema_version":"1.0","module":{"id":"authority-unpublished-b","type":"lesson","title":"Unpublished B"}}', '10000000-0000-4000-8000-000000000003', false);

set local role anon;
do $$
begin
  begin
    perform count(*) from public.modules;
    raise exception 'Anonymous Module browse was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.current_account_access();
    raise exception 'Anonymous authority RPC was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- A signed-in Account with no access row is Pending, even if a stale token
-- claims approval and Teacher permission.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","app_metadata":{"approved":true,"role":"Teacher"}}', true);
do $$
declare access jsonb;
begin
  select public.current_account_access() into access;
  if access <> '{"account_id":"10000000-0000-4000-8000-000000000004","approved":false,"role":"Student","active":true}'::jsonb then
    raise exception 'Pending Account access mismatch: %', access;
  end if;
  if (select count(*) from public.modules) <> 0 then
    raise exception 'Pending Account could browse Modules';
  end if;
end $$;
reset role;

-- Approved Students see only published Modules and cannot author.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","app_metadata":{"approved":false,"role":"Teacher"}}', true);
do $$
begin
  if (select count(*) from public.modules) <> 1 then
    raise exception 'Approved Student should see exactly one published Module';
  end if;
  begin
    insert into public.modules (data, owner, published)
    values ('{"schema_version":"1.0","module":{"id":"student-write","type":"lesson","title":"Student write"}}', '10000000-0000-4000-8000-000000000001', false);
    raise exception 'Student write was accepted';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update app_private.account_access set role = 'Teacher'
    where account_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Student self-promotion was accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

-- With the same old approval claim, the next request sees withdrawal.
update app_private.account_access
set approved = false
where account_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","app_metadata":{"approved":true,"role":"Student"}}', true);
do $$
begin
  if (select count(*) from public.modules) <> 0 then
    raise exception 'Withdrawn approval still browsed published Modules';
  end if;
  if public.current_account_access()->>'approved' <> 'false' then
    raise exception 'Withdrawn approval did not reach online RPC';
  end if;
end $$;
reset role;

-- Teacher permission is independent of learning approval; unpublished sealed
-- Modules stay owned. Plaintext Drafts never enter Supabase.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","app_metadata":{"approved":true,"role":"Student"}}', true);
do $$
declare affected integer;
begin
  if (select count(*) from public.modules) <> 2 then
    raise exception 'Teacher without learning approval should see only own sealed Modules';
  end if;
  if not exists (select 1 from public.modules where id = 'authority-unpublished-a') then
    raise exception 'Teacher cannot see own unpublished sealed Module';
  end if;
  if exists (select 1 from public.modules where id = 'authority-unpublished-b') then
    raise exception 'Teacher can see another Teacher unpublished sealed Module';
  end if;
  insert into public.modules (data, owner, published)
  values ('{"schema_version":"1.0","module":{"id":"teacher-write","type":"lesson","title":"Teacher write"}}', '10000000-0000-4000-8000-000000000002', false);
  update public.modules set published = true where id = 'authority-unpublished-b';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Teacher updated another Teacher sealed Module';
  end if;
  delete from public.modules where id = 'authority-unpublished-b';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Teacher deleted another Teacher sealed Module';
  end if;
  begin
    update public.modules
    set owner = '10000000-0000-4000-8000-000000000003'
    where id = 'authority-unpublished-a';
    raise exception 'Teacher transferred a Module to another Account';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Removing Teacher permission blocks writes without revoking learning.
update app_private.account_access
set role = 'Student', approved = true
where account_id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","app_metadata":{"approved":true,"role":"Teacher"}}', true);
do $$
begin
  if public.current_account_access()->>'role' <> 'Student' then
    raise exception 'Removed Teacher permission survived in online RPC';
  end if;
  begin
    insert into public.modules (data, owner, published)
    values ('{"schema_version":"1.0","module":{"id":"removed-teacher-write","type":"lesson","title":"Old Teacher"}}', '10000000-0000-4000-8000-000000000002', false);
    raise exception 'Removed Teacher could still author';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- An old token with approved/Teacher claims loses access on the next request.
update app_private.account_access
set active = false
where account_id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","app_metadata":{"approved":true,"role":"Teacher"}}', true);
do $$
declare access jsonb;
begin
  select public.current_account_access() into access;
  if access->>'active' <> 'false' or access->>'account_id' <> '10000000-0000-4000-8000-000000000002' then
    raise exception 'Revoked Account was not reported current and inactive: %', access;
  end if;
  if (select count(*) from public.modules) <> 0 then
    raise exception 'Revoked Account could read Modules';
  end if;
end $$;
reset role;

rollback;
