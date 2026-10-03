-- Migration 0002: sealed-shape validation — THE NO-PLAINTEXT BACKSTOP.
-- (spec: supabase-database, design "Server-Side Sealed-Shape Validation";
--  Correctness Properties 2 Seal-before-store, 3 Contract validity, 7 No draft path)
--
-- This is the security backbone. `assert_sealed_module` inspects the incoming
-- `data` JSONB and RAISES on any violation; the BEFORE INSERT OR UPDATE trigger
-- runs it on every write FOR ALL ROLES (service role included), so no row that
-- is unsealed, carries plaintext, or breaks the module contract can ever land —
-- even if the client is bypassed.
--
-- Honest framing (specs 00/04): this keeps plaintext answers OUT of storage. It
-- is tamper-resistance, not a cryptographic-secrecy claim.
-- Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1, 8.5

create or replace function public.assert_sealed_module(data jsonb)
returns void
language plpgsql
as $$
declare
  q      jsonb;
  banned text;
begin
  -- Contract envelope (spec 00). Req 4.1, 4.2
  if data->>'schema_version' is distinct from '1.0' then
    raise exception 'module rejected: schema_version must be "1.0"';
  end if;
  if (data->'module'->>'id') is null or length(data->'module'->>'id') = 0 then
    raise exception 'module rejected: module.id is required';
  end if;
  if (data->'module'->>'type') not in ('quiz','lesson') then
    raise exception 'module rejected: module.type must be quiz or lesson';
  end if;
  if (data->'module'->>'title') is null or length(data->'module'->>'title') = 0 then
    raise exception 'module rejected: module.title is required';
  end if;

  -- If a quiz is present it must be a SEALED quiz honoring the contract.
  if data ? 'quiz' then
    -- Req 4.3
    if (data->'quiz'->>'hash_algo') is distinct from 'SHA-256' then
      raise exception 'module rejected: quiz.hash_algo must be "SHA-256"';
    end if;
    -- Req 4.4
    if (data->'quiz'->>'normalization')
         is distinct from 'lowercase|trim|collapse-ws|strip-punct' then
      raise exception 'module rejected: quiz.normalization does not match the contract';
    end if;
    -- Req 4.5
    if jsonb_typeof(data->'quiz'->'questions') <> 'array'
       or jsonb_array_length(data->'quiz'->'questions') < 1 then
      raise exception 'module rejected: quiz.questions must be a non-empty array';
    end if;

    -- Every question must be sealed and carry NO plaintext answer.
    for q in select * from jsonb_array_elements(data->'quiz'->'questions')
    loop
      if (q->>'id') is null or length(q->>'id') = 0 then
        raise exception 'module rejected: a question is missing id';
      end if;
      -- Req 4.6
      if (q->>'kind') not in ('multiple_choice','identification','true_false') then
        raise exception 'module rejected: question % has an unknown kind', q->>'id';
      end if;
      -- Req 3.1, 3.2 — sealed: salt + answer_hash present and non-empty
      if (q->>'salt') is null or length(q->>'salt') = 0 then
        raise exception 'module rejected: question % is missing salt (unsealed)', q->>'id';
      end if;
      if (q->>'answer_hash') is null or length(q->>'answer_hash') = 0 then
        raise exception 'module rejected: question % is missing answer_hash (unsealed)', q->>'id';
      end if;

      -- Req 3.3 — explicitly forbid any plaintext-answer key (reject DraftModule shapes).
      foreach banned in array array['answer','correct_answer','correctAnswer','plaintext','answer_text']
      loop
        if q ? banned then
          raise exception
            'module rejected: question % carries plaintext key "%" — publish only SEALED modules',
            q->>'id', banned;
        end if;
      end loop;
    end loop;
  end if;
end;
$$;

-- The write-time trigger: validate, then DERIVE the metadata projection from `data`
-- (Req 8.1, 8.5) so the client only ever supplies `data` (+ published) and the
-- columns can never desync from the source of truth.
create or replace function public.modules_validate()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_sealed_module(new.data);

  new.id             := new.data->'module'->>'id';
  new.title          := new.data->'module'->>'title';
  new.subject        := new.data->'module'->>'subject';
  new.grade_level    := new.data->'module'->>'grade_level';
  new.type           := new.data->'module'->>'type';
  new.question_count := coalesce(jsonb_array_length(new.data->'quiz'->'questions'), 0);
  return new;
end;
$$;

-- Req 3.4 — runs on every INSERT and UPDATE, for ALL roles including service_role.
drop trigger if exists modules_validate_before_write on public.modules;
create trigger modules_validate_before_write
  before insert or update on public.modules
  for each row execute function public.modules_validate();
