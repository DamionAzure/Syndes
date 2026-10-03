-- Migration 0004: school directory and Administrator-assigned access.
-- (ADR-0004 accepted, ADR-0007; roles and invites from docs/Spec A)
--
-- What this adds:
--   * profiles with an app_role (student | teacher | admin) and a status, born
--     as 'student' on first sign-in. Signing in never grants Teacher access.
--   * sections, classes, teacher_assignments, enrollments: who teaches and who
--     learns where, with history (rows are ended, never deleted).
--   * learner_period_results + school_statistics_snapshots: the counts behind
--     enrolled / passing / failing / drop rates, each with a timestamp.
--   * access_events: an append-only log of every Administrator change.
--
-- The security model:
--   * No table accepts direct writes from the client except Teachers recording
--     results for their own Learners. Every access change goes through an
--     admin_* function below. Each is SECURITY DEFINER, starts with
--     require_admin(), and reads the caller's CURRENT role from profiles. A
--     token issued before access was removed therefore stops working at once,
--     which is ADR-0004's "online check of current authorization".
--   * Helper functions are SECURITY DEFINER so RLS policies can ask
--     "is the caller an admin?" without reading profiles through RLS. A
--     policy on profiles that selects from profiles would recurse.
--   * search_path is pinned to '' and every name is schema-qualified.
--
-- Not yet executed against a database (no Supabase CLI here). Run it with
-- the steps in supabase/README.md before relying on it.

-- ---------------------------------------------------------------------------
-- Roles and profiles
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('student', 'teacher', 'admin');
  end if;
end;
$$;

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  given_name   text not null default '',
  family_name  text not null default '',
  lrn          text unique,
  role         public.app_role not null default 'student',
  status       text not null default 'active' check (status in ('active', 'removed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new sign-in becomes a Student, whatever the signup payload says.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The caller's current role, or null when signed out or removed.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'active';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an administrator can do this' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- School structure
-- ---------------------------------------------------------------------------

create table if not exists public.sections (
  id           uuid primary key default gen_random_uuid(),
  grade_level  text not null check (length(trim(grade_level)) > 0),
  name         text not null check (length(trim(name)) > 0),
  created_at   timestamptz not null default now()
);
create unique index if not exists sections_grade_name_key
  on public.sections (grade_level, lower(name));

create table if not exists public.classes (
  id             uuid primary key default gen_random_uuid(),
  section_id     uuid not null references public.sections (id) on delete restrict,
  learning_area  text not null check (length(trim(learning_area)) > 0),
  created_at     timestamptz not null default now()
);
create unique index if not exists classes_section_area_key
  on public.classes (section_id, lower(learning_area));

create table if not exists public.teacher_assignments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete restrict,
  teacher_id  uuid not null references public.profiles (id) on delete restrict,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
-- At most one current teacher per class.
create unique index if not exists teacher_assignments_one_current
  on public.teacher_assignments (class_id) where ended_at is null;
create index if not exists teacher_assignments_teacher_idx
  on public.teacher_assignments (teacher_id) where ended_at is null;

create table if not exists public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  learner_id  uuid not null references public.profiles (id) on delete restrict,
  section_id  uuid not null references public.sections (id) on delete restrict,
  status      text not null default 'enrolled'
                check (status in ('enrolled', 'moved', 'dropped', 'transferred')),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  check ((status = 'enrolled') = (ended_at is null))
);
-- At most one current section per learner.
create unique index if not exists enrollments_one_current
  on public.enrollments (learner_id) where ended_at is null;
create index if not exists enrollments_section_idx
  on public.enrollments (section_id) where ended_at is null;

create table if not exists public.access_events (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid not null references public.profiles (id),
  action      text not null,
  subject_id  uuid not null,
  summary     text not null
);
create index if not exists access_events_at_idx on public.access_events (at desc);

-- Statistics inputs and outputs.
create table if not exists public.learner_period_results (
  learner_id       uuid not null references public.profiles (id) on delete restrict,
  school_year      text not null,
  period           text not null,
  general_average  numeric(5, 2) not null check (general_average between 60 and 100),
  recorded_by      uuid not null references public.profiles (id),
  recorded_at      timestamptz not null default now(),
  primary key (learner_id, school_year, period)
);

create table if not exists public.school_statistics_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  captured_at        timestamptz not null default now(),
  captured_by        uuid not null references public.profiles (id),
  school_year        text not null,
  period             text not null,
  enrolled_at_start  int not null check (enrolled_at_start >= 0),
  enrolled           int not null check (enrolled >= 0),
  assessed           int not null check (assessed >= 0),
  passing            int not null check (passing >= 0),
  failing            int not null check (failing >= 0),
  dropped            int not null check (dropped >= 0),
  check (passing + failing = assessed)
);

-- ---------------------------------------------------------------------------
-- Who teaches whom (used by RLS)
-- ---------------------------------------------------------------------------

-- True when the caller currently teaches a class in the learner's current section.
create or replace function public.teaches_learner(p_learner uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'teacher', false) and exists (
    select 1
    from public.enrollments e
    join public.classes c on c.section_id = e.section_id
    join public.teacher_assignments a on a.class_id = c.id and a.ended_at is null
    where e.learner_id = p_learner and e.ended_at is null and a.teacher_id = auth.uid()
  );
$$;

create or replace function public.teaches_section(p_section uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'teacher', false) and exists (
    select 1
    from public.classes c
    join public.teacher_assignments a on a.class_id = c.id and a.ended_at is null
    where c.section_id = p_section and a.teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security: reads only. Writes go through the functions below.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.classes enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.enrollments enable row level security;
alter table public.access_events enable row level security;
alter table public.learner_period_results enable row level security;
alter table public.school_statistics_snapshots enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.teaches_learner(id));

drop policy if exists sections_read on public.sections;
create policy sections_read on public.sections for select to authenticated
  using (public.current_app_role() is not null);

drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated
  using (public.current_app_role() is not null);

drop policy if exists assignments_read on public.teacher_assignments;
create policy assignments_read on public.teacher_assignments for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments for select to authenticated
  using (learner_id = auth.uid() or public.is_admin() or public.teaches_section(section_id));

drop policy if exists access_events_read on public.access_events;
create policy access_events_read on public.access_events for select to authenticated
  using (public.is_admin());

drop policy if exists results_read on public.learner_period_results;
create policy results_read on public.learner_period_results for select to authenticated
  using (learner_id = auth.uid() or public.is_admin() or public.teaches_learner(learner_id));

-- The one direct write: a Teacher records results for Learners they teach, as themselves.
drop policy if exists results_insert on public.learner_period_results;
create policy results_insert on public.learner_period_results for insert to authenticated
  with check (recorded_by = auth.uid() and public.teaches_learner(learner_id));

drop policy if exists results_update on public.learner_period_results;
create policy results_update on public.learner_period_results for update to authenticated
  using (public.teaches_learner(learner_id))
  with check (recorded_by = auth.uid() and public.teaches_learner(learner_id));

drop policy if exists snapshots_read on public.school_statistics_snapshots;
create policy snapshots_read on public.school_statistics_snapshots for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Administrator actions. Same rules as features/school-directory/directory-actions.ts.
-- ---------------------------------------------------------------------------

create or replace function public.log_access_event(p_action text, p_subject uuid, p_summary text)
returns void
language sql
security definer set search_path = ''
as $$
  insert into public.access_events (actor_id, action, subject_id, summary)
  values (auth.uid(), p_action, p_subject, p_summary);
$$;

create or replace function public.admin_grant_teacher(p_account uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform public.require_admin();
  select * into p from public.profiles where id = p_account for update;
  if not found or p.status <> 'active' then raise exception 'account is missing or removed'; end if;
  if p.role <> 'student' then raise exception 'account already has teacher or administrator access'; end if;
  if exists (select 1 from public.enrollments where learner_id = p_account and ended_at is null) then
    raise exception 'remove the learner from their section first';
  end if;
  update public.profiles set role = 'teacher', lrn = null where id = p_account;
  perform public.log_access_event('teacher-access-granted', p_account, 'Gave Teacher access to ' || p.email);
end;
$$;

create or replace function public.admin_remove_teacher(p_account uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform public.require_admin();
  select * into p from public.profiles where id = p_account for update;
  if not found or p.role <> 'teacher' then raise exception 'account does not have teacher access'; end if;
  update public.teacher_assignments set ended_at = now() where teacher_id = p_account and ended_at is null;
  update public.profiles set role = 'student' where id = p_account;
  perform public.log_access_event('teacher-access-removed', p_account, 'Removed Teacher access from ' || p.email);
end;
$$;

-- Parameters are prefixed p_ so they can never be mistaken for column names.
create or replace function public.admin_assign_teacher(p_class uuid, p_teacher uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.profiles where id = p_teacher and role = 'teacher' and status = 'active') then
    raise exception 'the account needs teacher access before it can be assigned';
  end if;
  if exists (
    select 1 from public.teacher_assignments
    where class_id = p_class and teacher_id = p_teacher and ended_at is null
  ) then
    raise exception 'this teacher already teaches this class';
  end if;
  update public.teacher_assignments set ended_at = now() where class_id = p_class and ended_at is null;
  insert into public.teacher_assignments (class_id, teacher_id) values (p_class, p_teacher);
  perform public.log_access_event('teacher-assigned', p_class, 'Assigned a teacher to a class');
end;
$$;

create or replace function public.admin_unassign_teacher(p_class uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.teacher_assignments set ended_at = now() where class_id = p_class and ended_at is null;
  if not found then raise exception 'this class has no teacher assigned'; end if;
  perform public.log_access_event('teacher-unassigned', p_class, 'Unassigned the teacher from a class');
end;
$$;

-- Enrolls, or moves a learner who is already in another section.
create or replace function public.admin_enroll_learner(p_learner uuid, p_section uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  current_section uuid;
begin
  perform public.require_admin();
  if not exists (select 1 from public.profiles where id = p_learner and role = 'student' and status = 'active') then
    raise exception 'only an active learner account can be enrolled';
  end if;
  select section_id into current_section from public.enrollments
    where learner_id = p_learner and ended_at is null for update;
  if current_section = p_section then raise exception 'the learner is already in this section'; end if;
  if current_section is not null then
    update public.enrollments set status = 'moved', ended_at = now()
      where learner_id = p_learner and ended_at is null;
  end if;
  insert into public.enrollments (learner_id, section_id) values (p_learner, p_section);
  perform public.log_access_event(
    case when current_section is null then 'learner-enrolled' else 'learner-moved' end,
    p_learner,
    case when current_section is null then 'Enrolled a learner in a section' else 'Moved a learner to another section' end
  );
end;
$$;

create or replace function public.admin_remove_learner(p_learner uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_reason not in ('dropped', 'transferred') then raise exception 'reason must be dropped or transferred'; end if;
  update public.enrollments set status = p_reason, ended_at = now()
    where learner_id = p_learner and ended_at is null;
  if not found then raise exception 'the learner is not enrolled in a section'; end if;
  perform public.log_access_event(
    case p_reason when 'dropped' then 'learner-dropped' else 'learner-transferred' end,
    p_learner,
    case p_reason when 'dropped' then 'Recorded a learner as dropped' else 'Recorded a learner as transferred out' end
  );
end;
$$;

create or replace function public.admin_remove_access(p_account uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform public.require_admin();
  if p_account = auth.uid() then raise exception 'you cannot remove your own access'; end if;
  select * into p from public.profiles where id = p_account for update;
  if not found or p.status <> 'active' then raise exception 'account is missing or already removed'; end if;
  if p.role = 'admin' then raise exception 'administrator access is changed by the system owner'; end if;
  if exists (select 1 from public.enrollments where learner_id = p_account and ended_at is null) then
    raise exception 'remove the learner from their section first and record why they left';
  end if;
  update public.teacher_assignments set ended_at = now() where teacher_id = p_account and ended_at is null;
  update public.profiles set status = 'removed' where id = p_account;
  perform public.log_access_event('access-removed', p_account, 'Removed all access for ' || p.email);
end;
$$;

-- Restored accounts come back as Learn only.
create or replace function public.admin_restore_access(p_account uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform public.require_admin();
  select * into p from public.profiles where id = p_account for update;
  if not found or p.status <> 'removed' then raise exception 'account already has access'; end if;
  update public.profiles set status = 'active', role = 'student' where id = p_account;
  perform public.log_access_event('access-restored', p_account, 'Restored access for ' || p.email);
end;
$$;

create or replace function public.admin_create_section(p_grade_level text, p_name text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform public.require_admin();
  insert into public.sections (grade_level, name) values (trim(p_grade_level), trim(p_name))
    returning id into new_id;
  perform public.log_access_event('section-created', new_id, 'Created ' || trim(p_grade_level) || ' ' || trim(p_name));
  return new_id;
end;
$$;

create or replace function public.admin_add_class(p_section uuid, p_learning_area text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform public.require_admin();
  insert into public.classes (section_id, learning_area) values (p_section, trim(p_learning_area))
    returning id into new_id;
  perform public.log_access_event('class-added', new_id, 'Added ' || trim(p_learning_area) || ' to a section');
  return new_id;
end;
$$;

-- Counts the school now and stores the snapshot with its timestamp.
-- enrolled_at_start counts every learner whose enrollment began on or before p_year_start.
create or replace function public.capture_school_statistics(p_year text, p_period text, p_year_start timestamptz)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform public.require_admin();
  insert into public.school_statistics_snapshots
    (captured_by, school_year, period, enrolled_at_start, enrolled, assessed, passing, failing, dropped)
  select
    auth.uid(), p_year, p_period,
    (select count(distinct x.learner_id) from public.enrollments x where x.started_at <= p_year_start),
    count(*),
    count(r.learner_id),
    count(r.learner_id) filter (where r.general_average >= 75),
    count(r.learner_id) filter (where r.general_average < 75),
    (select count(*) from public.enrollments d where d.status = 'dropped' and d.ended_at >= p_year_start)
  from public.enrollments e
  left join public.learner_period_results r
    on r.learner_id = e.learner_id and r.school_year = p_year and r.period = p_period
  where e.ended_at is null
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution rights: signed-out callers get nothing; each function checks the role itself.
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.admin_grant_teacher(uuid)',
    'public.admin_remove_teacher(uuid)',
    'public.admin_assign_teacher(uuid, uuid)',
    'public.admin_unassign_teacher(uuid)',
    'public.admin_enroll_learner(uuid, uuid)',
    'public.admin_remove_learner(uuid, text)',
    'public.admin_remove_access(uuid)',
    'public.admin_restore_access(uuid)',
    'public.admin_create_section(text, text)',
    'public.admin_add_class(uuid, text)',
    'public.capture_school_statistics(text, text, timestamptz)',
    'public.log_access_event(text, uuid, text)',
    'public.require_admin()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
  -- Only the admin_* functions may write the log.
  execute 'revoke execute on function public.log_access_event(text, uuid, text) from authenticated';
end;
$$;
