// Conformance guard: the SEALED module JSON the authoring lane emits must satisfy
// the shared contract in docs/module.schema.json (spec 00). The emitter
// (toDraftModuleFile) produces an UNSEALED draft carrying plaintext `answer`;
// sealing — swapping each `answer` for `{salt, answer_hash}` — happens in the Rust
// core (seal_module), which a jsdom test cannot invoke. So this test reproduces the
// sealed SHAPE locally (the exact field swap seal_module performs) and validates it
// against the real schema with Ajv (draft 2020-12). It also asserts the negative:
// the unsealed draft, with plaintext answers, must FAIL the schema — locking in that
// only sealed output is contract-valid.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { createDraft, EMPTY_DRAFTS } from "./draft-store";
import type { ModuleDraft } from "./draft-types";
import { toDraftModuleFile, type DraftModuleFile } from "./module-file";

const NOW = "2026-10-04T08:00:00.000Z";

// Resolve docs/module.schema.json from this test file's location:
// src/features/authoring/ -> up to Syndes/ (4) -> up to repo Syndes/ (1 more) ...
// The schema lives at <repo>/docs/module.schema.json, i.e. two levels above the
// frontend package root. Resolve by walking up to the frontend root, then out.
const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "../../.."); // .../Syndes/frontend
const schemaPath = resolve(frontendRoot, "../../docs/module.schema.json"); // <repo>/docs
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

/** A draft that exercises all three question kinds and a lesson block. */
function readyDraft(): ModuleDraft {
  const store = createDraft(EMPTY_DRAFTS, "module", "d1", NOW);
  const draft = store.drafts["d1"] as ModuleDraft;
  return {
    ...draft,
    title: "Water cycle",
    subject: "Science",
    gradeLevel: "Grade 6",
    lessons: [
      {
        id: "l1",
        title: "Where rain comes from",
        minutes: 5,
        blocks: [{ id: "b1", kind: "paragraph", text: "Water evaporates and condenses." }],
      },
    ],
    questions: [
      { id: "q1", kind: "multiple_choice", prompt: "What forms clouds?", options: ["Vapour", "Sand"], correctIndex: 0, points: 1 },
      { id: "q2", kind: "true_false", prompt: "Rain is water.", answer: "True", points: 1 },
      { id: "q3", kind: "identification", prompt: "Name the process.", answer: "Evaporation", points: 2 },
    ],
  };
}

/**
 * Reproduce EXACTLY what the Rust core's seal_module does to the shape: drop the
 * plaintext `answer` from every question and replace it with `salt` + `answer_hash`
 * (fixed stand-in values here — this test checks SHAPE conformance, not the real
 * hashing, which is covered by the Rust seal tests). Everything else is passed
 * through verbatim.
 */
function sealShape(file: DraftModuleFile): unknown {
  if (!file.quiz) return file;
  return {
    ...file,
    quiz: {
      hash_algo: file.quiz.hash_algo,
      normalization: file.quiz.normalization,
      questions: file.quiz.questions.map((q) => {
        const { answer: _answer, ...rest } = q;
        void _answer;
        return {
          ...rest,
          salt: "a1b2c3d4e5f6",
          answer_hash: "9f".repeat(32), // 64 hex chars, SHA-256 shape
        };
      }),
    },
  };
}

describe("module.schema.json conformance", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  it("accepts the SEALED emitter output", () => {
    const sealed = sealShape(toDraftModuleFile(readyDraft()));
    const ok = validate(sealed);
    // Surface Ajv's errors verbatim when this fails, so a schema drift is obvious.
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it("accepts a lesson-only sealed module (no quiz)", () => {
    const draft = readyDraft();
    draft.questions = [];
    const sealed = sealShape(toDraftModuleFile(draft));
    expect(validate(sealed)).toBe(true);
  });

  it("REJECTS the unsealed draft (plaintext answer, no salt/hash)", () => {
    // The raw emitter output carries `answer` and lacks `salt`/`answer_hash`, so a
    // question object fails the schema's `question` $def. This is the invariant:
    // a plaintext-carrying file is NOT contract-valid.
    const unsealed = toDraftModuleFile(readyDraft());
    expect(validate(unsealed)).toBe(false);
  });

  it("REJECTS a sealed module whose identification question carries options", () => {
    const file = toDraftModuleFile(readyDraft());
    const sealed = sealShape(file) as {
      quiz: { questions: Array<Record<string, unknown>> };
    };
    // q3 is identification; the schema forbids `options` on it.
    const idQuestion = sealed.quiz.questions.find((q) => q["kind"] === "identification");
    expect(idQuestion).toBeDefined();
    (idQuestion as Record<string, unknown>)["options"] = ["A", "B"];
    expect(validate(sealed)).toBe(false);
  });
});
