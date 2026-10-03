-- Migration 0001: the `modules` table — the online store for already-SEALED,
-- contract-valid modules (spec: supabase-database, design "SQL DDL").
--
-- `data` (JSONB) is the SOURCE OF TRUTH: the exact sealed Module bytes that the
-- Rust core's load_module consumes unchanged. The other columns are a queryable
-- PROJECTION of `data` for browse/list only — never authoritative over it. The
-- projection is derived server-side by the validation trigger (migration 0002),
-- so a client cannot desync the columns from `data`.
--
-- Security backbone lives in later migrations: 0002 adds the sealed-shape
-- validation trigger (the no-plaintext backstop); the Account authority
-- migration adds current-state RLS policies.
-- Requirements: 1.1, 1.2, 8.1, 11.6

create table if not exists public.modules (
  id             text primary key,                 -- = data->'module'->>'id' (spec 00 stable id)
  data           jsonb not null,                   -- the sealed Module JSON (salt + answer_hash only)
  title          text not null,
  subject        text,
  grade_level    text,                             -- presentation only, NEVER scoring
  type           text not null check (type in ('quiz','lesson')),
  question_count int  not null default 0 check (question_count >= 0),
  owner          uuid references auth.users (id) on delete set null,
  published      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Browse/list indexes: filter by subject/grade_level on published rows, sort newest-first.
create index if not exists modules_published_created_idx
  on public.modules (published, created_at desc);
create index if not exists modules_subject_idx
  on public.modules (subject) where published;
create index if not exists modules_grade_level_idx
  on public.modules (grade_level) where published;
create index if not exists modules_owner_idx
  on public.modules (owner);

-- Keep updated_at honest on every change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists modules_set_updated_at on public.modules;
create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();
