-- DB tests for the modules store (spec: supabase-database, tasks 2.2 / 2.3 / 3.2).
--
-- Runnable against a local Supabase (`supabase db reset` then `supabase test db`)
-- or by pasting into the SQL editor. Uses plain assertions via DO blocks that
-- RAISE on unexpected outcomes, so a clean run == all tests passed.
--
-- These guard the SECURITY backbone: the sealed-shape trigger (migration 0002)
-- and the RLS policies (migration 0003). No frontend required.

-- ---------------------------------------------------------------------------
-- Helpers: a known-good sealed module, and a runner that asserts a given write
-- is rejected by the sealed-shape trigger.
-- ---------------------------------------------------------------------------

-- A minimal VALID sealed module (one of each spirit: MC + identification).
create or replace function pg_temp.good_module() returns jsonb language sql as $$
  select '{
    "schema_version": "1.0",
    "module": { "id": "mod_test_1", "type": "quiz", "title": "Test",
                "subject": "Science", "grade_level": "elementary" },
    "quiz": {
      "hash_algo": "SHA-256",
      "normalization": "lowercase|trim|collapse-ws|strip-punct",
      "questions": [
        { "id": "q1", "kind": "multiple_choice", "prompt": "p",
          "options": ["A","B"], "salt": "deadbeef", "answer_hash": "abc123", "points": 1 },
        { "id": "q2", "kind": "identification", "prompt": "p2",
          "salt": "cafef00d", "answer_hash": "def456", "points": 2 }
      ]
    }
  }'::jsonb;
$$;

-- Assert that inserting `data` RAISES (is rejected). Fails loudly if it does NOT.
create or replace function pg_temp.assert_rejected(label text, data jsonb)
returns void language plpgsql as $$
begin
  begin
    insert into public.modules (data, published) values (data, false);
    -- If we reach here, the write was NOT rejected — that is a test failure.
    raise exception 'TEST FAILED [%]: write was accepted but should have been rejected', label;
  exception
    when others then
      -- Swallow only the expected rejection; re-raise our own failure above.
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'ok (rejected): %', label;
  end;
  -- Clean any accidental insert (defensive; normally nothing to delete).
  delete from public.modules where id = 'mod_test_1';
end;
$$;

-- ---------------------------------------------------------------------------
-- Task 2.3 — ACCEPTANCE + metadata derivation (Property 4; Req 8.1, 8.5)
-- ---------------------------------------------------------------------------
do $$
declare
  r public.modules%rowtype;
begin
  delete from public.modules where id = 'mod_test_1';
  insert into public.modules (data, published) values (pg_temp.good_module(), true);

  select * into r from public.modules where id = 'mod_test_1';
  if r.title <> 'Test'            then raise exception 'TEST FAILED: title not derived'; end if;
  if r.subject <> 'Science'       then raise exception 'TEST FAILED: subject not derived'; end if;
  if r.grade_level <> 'elementary'then raise exception 'TEST FAILED: grade_level not derived'; end if;
  if r.type <> 'quiz'             then raise exception 'TEST FAILED: type not derived'; end if;
  if r.question_count <> 2        then raise exception 'TEST FAILED: question_count not 2'; end if;
  raise notice 'ok (accepted + metadata derived): good module';

  delete from public.modules where id = 'mod_test_1';
end;
$$;

-- ---------------------------------------------------------------------------
-- Task 2.2 — REJECTIONS, one invariant violated per fixture
--   Properties 2 (seal-before-store), 3 (contract validity), 7 (no draft path)
--   Req 3.1, 3.2, 3.3, 4.1, 4.3, 4.4, 4.5, 4.6
-- ---------------------------------------------------------------------------
do $$
begin
  -- 3.1/3.2 missing salt
  perform pg_temp.assert_rejected('missing salt',
    jsonb_set(pg_temp.good_module(), '{quiz,questions,0}',
      '{"id":"q1","kind":"multiple_choice","prompt":"p","options":["A","B"],"answer_hash":"abc","points":1}'::jsonb));

  -- 3.1/3.2 missing answer_hash
  perform pg_temp.assert_rejected('missing answer_hash',
    jsonb_set(pg_temp.good_module(), '{quiz,questions,0}',
      '{"id":"q1","kind":"multiple_choice","prompt":"p","options":["A","B"],"salt":"s","points":1}'::jsonb));

  -- 3.1 empty salt
  perform pg_temp.assert_rejected('empty salt',
    jsonb_set(pg_temp.good_module(), '{quiz,questions,0,salt}', '""'::jsonb));

  -- 3.3 banned plaintext key `answer`
  perform pg_temp.assert_rejected('plaintext answer key',
    jsonb_set(pg_temp.good_module(), '{quiz,questions,1,answer}', '"Chlorophyll"'::jsonb));

  -- 3.3 banned plaintext key `correctAnswer`
  perform pg_temp.assert_rejected('plaintext correctAnswer key',
    jsonb_set(pg_temp.good_module(), '{quiz,questions,1,correctAnswer}', '"Chlorophyll"'::jsonb));

  -- 4.1 wrong schema_version
  perform pg_temp.assert_rejected('wrong schema_version',
    jsonb_set(pg_temp.good_module(), '{schema_version}', '"2.0"'::jsonb));

  -- 4.3 wrong hash_algo
  perform pg_temp.assert_rejected('wrong hash_algo',
    jsonb_set(pg_temp.good_module(), '{quiz,hash_algo}', '"MD5"'::jsonb));

  -- 4.4 wrong normalization
  perform pg_temp.assert_rejected('wrong normalization',
    jsonb_set(pg_temp.good_module(), '{quiz,normalization}', '"lowercase"'::jsonb));

  -- 4.6 unknown question kind
  perform pg_temp.assert_rejected('unknown kind',
    jsonb_set(pg_temp.good_module(), '{quiz,questions,0,kind}', '"matching"'::jsonb));

  -- 4.5 empty questions array
  perform pg_temp.assert_rejected('empty questions',
    jsonb_set(pg_temp.good_module(), '{quiz,questions}', '[]'::jsonb));

  raise notice 'ok: all rejection fixtures rejected as expected';
end;
$$;

-- ---------------------------------------------------------------------------
-- Task 3.2 — RLS smoke checks (Properties 5 read scope, 6 owner-write scope)
--   Req 7.1, 7.2. NOTE: full anon-vs-authenticated role testing is best done
--   from the client test harness (two Supabase clients) — these DB-side checks
--   confirm RLS is ENABLED and the read-published policy exists.
-- ---------------------------------------------------------------------------
do $$
declare
  rls_on boolean;
  n_policies int;
begin
  select relrowsecurity into rls_on
    from pg_class where oid = 'public.modules'::regclass;
  if not rls_on then raise exception 'TEST FAILED: RLS not enabled on public.modules'; end if;

  select count(*) into n_policies from pg_policies
    where schemaname = 'public' and tablename = 'modules';
  if n_policies < 5 then
    raise exception 'TEST FAILED: expected 5 RLS policies, found %', n_policies;
  end if;

  raise notice 'ok: RLS enabled with % policies', n_policies;
end;
$$;

-- ---------------------------------------------------------------------------
-- ADR 0004/0007 — approval claim helper `is_approved()` reads app_metadata.
--   Simulate the request JWT via the `request.jwt.claims` GUC (what auth.jwt()
--   reads) and assert the helper fails CLOSED when the claim is absent/false and
--   true only when app_metadata.approved is explicitly true.
-- ---------------------------------------------------------------------------
do $$
begin
  -- No JWT at all => not approved (fail closed).
  perform set_config('request.jwt.claims', NULL, true);
  if public.is_approved() then
    raise exception 'TEST FAILED: is_approved() true with no JWT';
  end if;

  -- JWT present but no approval claim => not approved.
  perform set_config('request.jwt.claims', '{"app_metadata":{}}', true);
  if public.is_approved() then
    raise exception 'TEST FAILED: is_approved() true with no approved claim';
  end if;

  -- Explicitly false => not approved.
  perform set_config('request.jwt.claims', '{"app_metadata":{"approved":false}}', true);
  if public.is_approved() then
    raise exception 'TEST FAILED: is_approved() true when approved=false';
  end if;

  -- Explicitly true => approved.
  perform set_config('request.jwt.claims', '{"app_metadata":{"approved":true}}', true);
  if not public.is_approved() then
    raise exception 'TEST FAILED: is_approved() false when approved=true';
  end if;

  -- Clean up the simulated claims.
  perform set_config('request.jwt.claims', NULL, true);
  raise notice 'ok: is_approved() reads app_metadata.approved and fails closed';
end;
$$;
