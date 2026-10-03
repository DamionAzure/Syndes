import { describe, expect, it } from "vitest";
import { checkDraft } from "./draft-checks";
import { createDraft, EMPTY_DRAFTS, move, parseDraftStore } from "./draft-store";
import type { ModuleDraft } from "./draft-types";
import { toDraftModuleFile } from "./module-file";

const NOW = "2026-10-04T08:00:00.000Z";

function blankDraft(start: ModuleDraft["start"] = "module"): ModuleDraft {
  const store = createDraft(EMPTY_DRAFTS, start, "d1", NOW);
  return store.drafts["d1"] as ModuleDraft;
}

function readyDraft(): ModuleDraft {
  const draft = blankDraft();
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
      { id: "q1", kind: "multiple_choice", prompt: "What forms clouds?", options: ["Vapour", "Sand", ""], correctIndex: 0, points: 1 },
      { id: "q2", kind: "true_false", prompt: "Rain is water.", answer: "True", points: 1 },
      { id: "q3", kind: "identification", prompt: "Name the process.", answer: " Evaporation ", points: 2 },
    ],
  };
}

describe("checkDraft", () => {
  it("passes a complete draft", () => {
    expect(checkDraft(readyDraft())).toEqual([]);
  });

  it("names every missing piece of a new draft", () => {
    const messages = checkDraft(blankDraft()).map((issue) => issue.message);
    expect(messages).toEqual([
      "Give the module a title.",
      "Add the subject.",
      "Lesson 1 needs a title.",
      "Lesson 1 needs at least one paragraph.",
      "Lesson 1 has an empty paragraph. Fill it in or remove it.",
    ]);
  });

  it("catches options that only differ in case or punctuation", () => {
    const draft = readyDraft();
    draft.questions = [
      { id: "q1", kind: "multiple_choice", prompt: "Pick", options: ["Carbon dioxide", "carbon dioxide!"], correctIndex: 0, points: 1 },
    ];
    expect(checkDraft(draft).map((issue) => issue.message)).toEqual(["Question 1 has two options that read the same."]);
  });

  it("needs a marked option that has text", () => {
    const draft = readyDraft();
    draft.questions = [
      { id: "q1", kind: "multiple_choice", prompt: "Pick", options: ["A", "B", ""], correctIndex: 2, points: 1 },
    ];
    expect(checkDraft(draft).map((issue) => issue.message)).toEqual(["Question 1 needs a correct option marked."]);
  });
});

describe("toDraftModuleFile", () => {
  it("produces the shape seal_module accepts, with option text as the answer", () => {
    const file = toDraftModuleFile(readyDraft());
    expect(file.module).toEqual({ id: "mod_d1", type: "quiz", title: "Water cycle", subject: "Science", grade_level: "Grade 6" });
    expect(file.lesson?.blocks).toEqual([
      { kind: "heading", text: "Where rain comes from" },
      { kind: "paragraph", text: "Water evaporates and condenses." },
    ]);
    expect(file.quiz?.questions).toEqual([
      { id: "q_q1", kind: "multiple_choice", prompt: "What forms clouds?", options: ["Vapour", "Sand"], answer: "Vapour", points: 1 },
      { id: "q_q2", kind: "true_false", prompt: "Rain is water.", options: ["True", "False"], answer: "True", points: 1 },
      { id: "q_q3", kind: "identification", prompt: "Name the process.", answer: "Evaporation", points: 2 },
    ]);
  });
});

describe("draft store", () => {
  it("drops malformed drafts instead of throwing", () => {
    const good = readyDraft();
    const parsed = parseDraftStore({ schema: 1, drafts: { d1: good, d2: { id: "d2", title: 4 } } });
    expect(Object.keys(parsed.drafts)).toEqual(["d1"]);
  });

  it("moves an item and ignores moves past either end", () => {
    expect(move(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });
});
