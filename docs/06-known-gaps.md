# 06 — Known Gaps & Next Steps

Status: **Accurate as of the event submission.** This records what is real and
tested vs. what is wired but incomplete, so the team (and anyone reading the
repo) has an honest map. Nothing here is a design flaw; the gaps fail safe.

## TL;DR

The offline scoring core, the seal/publish/pull path, the auth/session cache, and
the frontend<->backend command boundary are **real and tested**. The one path that
is **not end-to-end yet** is scoring a *browsed* module inside the app: the
student Library is still served from fixtures, and the Rust core has no way to
list on-device modules yet. It fails safe (a clear "could not be scored on this
device" notice), never a wrong score.

## Gap 1 — Student module-source is still fixtures (browse -> score not end-to-end)

**What works**
- The offline Rust scorer (score_submission/check_answer, spec 04) is real,
  typed, and unit-tested.
- The authoring -> seal -> publish -> pull path registers modules in the Rust
  ModuleStore correctly (load_module / pullModule call insert).
- The command boundary (names, camelCase args, payload validation) is verified,
  and the sealed module JSON conforms to module.schema.json (see the
  conformance test).

**What is incomplete**
- eatures/modules/module-source.ts hardcodes ctiveSource = fixtureModuleSource
  — it does **not** do the isTauri() real/fixture swap the other ports do. The
  Library screen always shows demo content.
- Because browsed modules are never loaded into the Rust ModuleStore, a real
  score_submission for a browsed id rejects with ModuleNotFound. The quiz view
  catches this and shows "could not be scored on this device." (Documented in
  eatures/quiz/tauri-quiz-scorer.ts.)

**Why it is not a quick wire (two real blockers)**
1. **No list/enumerate path in the core.** src-tauri/src/module_store.rs is an
   in-memory HashMap with only insert + get — no list, no disk enumeration.
   Modules enter one at a time via load_module/pullModule. Populating an
   in-app Library needs a NEW Rust command to enumerate modules/*.json (and/or
   list the store) plus its invoke_handler registration.
2. **Two different Module shapes.** The UI Module
   (eatures/modules/module-types.ts: ersion, summary, lessons[],
   lashcards[], eadyOffline, quiz.questions[]) is a richer demo model than
   the sealed contract Module (src-tauri/src/model.rs / module.schema.json:
   schema_version, module.{...}, lesson.blocks[], quiz.questions[] with
   salt+nswer_hash, no plaintext). Wiring the real source is a data-model
   **reconciliation** across the modules + quiz UI, not a one-line swap.

**Next step (post-event)**
- Add a Rust list_modules (enumerate modules/*.json, validate, return
  summaries) and a get_module/ensure-loaded command that registers into
  ModuleStore.
- Add a Tauri ModuleSource and flip module-source.ts to the isTauri() swap.
- Reconcile the UI Module type with the sealed contract (or add a mapping layer)
  so browsed modules render and score through the real core.
- Keep the fixture source as the non-Tauri (browser) fallback.

## Gap 2 — Supabase migration 0004 (school access) not executed/tested

rontend/supabase/migrations/0004_school_access.sql (profiles, sections,
classes, teacher assignments, enrollments, results, access events + dmin_*
SECURITY DEFINER functions) is authored but, per supabase/README.md, **not yet
run against an instance and has no SQL tests**. If the admin/school-directory
features are exercised against a live DB, those tables/functions may not exist.

**Next step:** apply 0001->0004 in order against the project, then write SQL tests
for 0004 mirroring 	ests/0001_sealed_shape_and_rls.test.sql.

## Gap 3 — Live, click-through smoke test is partial

The desktop app boots and serves the frontend over the Tauri bridge (verified:
window launches, GET / 200, SQLite startup advisory is non-fatal). What has NOT
been exercised by a human clicking the UI is a full teacher authoring flow
(seal_module/generate_module) and a student scoring flow end-to-end. These are
covered by unit/contract tests and the schema conformance test, but not by a live
walkthrough.

**Next step:** a manual QA pass on desktop (and the Android build) through
author -> seal -> publish/pull -> browse -> score.

## What is NOT a problem (for the record)

- The command boundary is consistent: every frontend invoke() maps to a
  registered Rust command; args line up via serde camelCase.
- The sealed module JSON contract agrees across the schema, Rust model/loader, and
  the frontend emitter (locked by a conformance test + deny_unknown_fields).
- Security invariants hold across lanes: sealing and scoring are Rust-only; the
  loose on-device role is never trusted without a signature verify; sealed
  payloads carry no plaintext answers.
