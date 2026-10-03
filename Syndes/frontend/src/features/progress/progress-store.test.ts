import { describe, expect, it } from "vitest";
import {
  continueTarget,
  EMPTY_PROGRESS,
  isCompleted,
  markFinalLessonReached,
  markQuizSubmitted,
  parseProgressStore,
  readModuleProgress,
  recordAnswer,
  recordStep,
  resetAllProgress,
  resetModuleProgress,
  retryQuiz,
} from "./progress-store";

const validEntry = {
  moduleId: "problem-solving",
  contentVersion: "1",
  step: { kind: "lesson", lesson: 2 },
  answers: { "ps-q1": "a" },
  finalLessonReached: false,
  quizSubmitted: false,
  updatedAt: "2026-10-01T09:00:00.000Z",
};

describe("reading saved progress", () => {
  it("keeps valid entries and drops malformed ones", () => {
    const store = parseProgressStore({
      schema: 1,
      modules: {
        "problem-solving": validEntry,
        broken: { moduleId: "broken", step: { kind: "lesson", lesson: -3 } },
        "not-an-object": "lesson 2",
      },
    });

    expect(Object.keys(store.modules)).toEqual(["problem-solving"]);
    expect(store.modules["problem-solving"]?.step).toEqual({ kind: "lesson", lesson: 2 });
  });
});

describe("content version changes", () => {
  const store = parseProgressStore({
    schema: 1,
    modules: { "problem-solving": validEntry },
  });

  it("returns saved progress when the version matches", () => {
    const read = readModuleProgress(store, { id: "problem-solving", version: "1" });

    expect(read).toEqual({ progress: store.modules["problem-solving"], stale: false });
  });

  it("discards progress saved against an older version and flags it", () => {
    const read = readModuleProgress(store, { id: "problem-solving", version: "2" });

    expect(read).toEqual({ progress: null, stale: true });
  });

  it("reports no progress and nothing stale for an unseen module", () => {
    const read = readModuleProgress(store, { id: "reading-maps", version: "1" });

    expect(read).toEqual({ progress: null, stale: false });
  });
});

describe("saving the learner's place", () => {
  const now = "2026-10-02T10:00:00.000Z";
  const moduleV1 = { id: "problem-solving", version: "1" };

  it("starts progress for a module seen for the first time", () => {
    const store = recordStep(EMPTY_PROGRESS, moduleV1, { kind: "lesson", lesson: 1 }, now);

    expect(readModuleProgress(store, moduleV1).progress).toEqual({
      moduleId: "problem-solving",
      contentVersion: "1",
      step: { kind: "lesson", lesson: 1 },
      answers: {},
      finalLessonReached: false,
      quizSubmitted: false,
      updatedAt: now,
    });
  });

  it("keeps earlier answers when the place moves", () => {
    const answered = recordAnswer(EMPTY_PROGRESS, moduleV1, "ps-q1", "a", now);
    const moved = recordStep(answered, moduleV1, { kind: "quiz", question: 2 }, now);

    expect(readModuleProgress(moved, moduleV1).progress?.answers).toEqual({ "ps-q1": "a" });
  });

  it("starts fresh instead of reusing answers from an older version", () => {
    const old = recordAnswer(EMPTY_PROGRESS, moduleV1, "ps-q1", "a", now);
    const moduleV2 = { id: "problem-solving", version: "2" };
    const store = recordStep(old, moduleV2, { kind: "lesson", lesson: 1 }, now);

    const progress = readModuleProgress(store, moduleV2).progress;
    expect(progress?.contentVersion).toBe("2");
    expect(progress?.answers).toEqual({});
  });
});

describe("completion", () => {
  const now = "2026-10-02T10:00:00.000Z";
  const withQuiz = { id: "problem-solving", version: "1", questionCount: 5 };
  const withoutQuiz = { id: "reading-maps", version: "1", questionCount: 0 };

  function progressOf(store: ReturnType<typeof recordStep>, moduleRef: typeof withQuiz) {
    const progress = readModuleProgress(store, moduleRef).progress;
    if (!progress) throw new Error("expected saved progress");
    return progress;
  }

  it("is not completed before the final lesson is reached", () => {
    const store = recordStep(EMPTY_PROGRESS, withoutQuiz, { kind: "lesson", lesson: 1 }, now);

    expect(isCompleted(progressOf(store, withoutQuiz), withoutQuiz)).toBe(false);
  });

  it("completes a module without a quiz once its final lesson is reached", () => {
    const store = markFinalLessonReached(EMPTY_PROGRESS, withoutQuiz, now);

    expect(isCompleted(progressOf(store, withoutQuiz), withoutQuiz)).toBe(true);
  });

  it("needs the quiz submitted when the module has one", () => {
    const reached = markFinalLessonReached(EMPTY_PROGRESS, withQuiz, now);
    expect(isCompleted(progressOf(reached, withQuiz), withQuiz)).toBe(false);

    const submitted = markQuizSubmitted(reached, withQuiz, now);
    expect(isCompleted(progressOf(submitted, withQuiz), withQuiz)).toBe(true);
  });
});

describe("retrying a quiz", () => {
  it("clears the answers and returns to question 1", () => {
    const now = "2026-10-02T10:00:00.000Z";
    const moduleRef = { id: "problem-solving", version: "1" };
    const answered = recordAnswer(EMPTY_PROGRESS, moduleRef, "ps-q1", "a", now);
    const submitted = markQuizSubmitted(answered, moduleRef, now);

    const progress = readModuleProgress(retryQuiz(submitted, moduleRef, now), moduleRef).progress;

    expect(progress?.answers).toEqual({});
    expect(progress?.quizSubmitted).toBe(false);
    expect(progress?.step).toEqual({ kind: "quiz", question: 1 });
  });
});

describe("resetting progress", () => {
  const now = "2026-10-02T10:00:00.000Z";
  const problemSolving = { id: "problem-solving", version: "1" };
  const readingMaps = { id: "reading-maps", version: "1" };
  const both = recordStep(
    recordStep(EMPTY_PROGRESS, problemSolving, { kind: "lesson", lesson: 2 }, now),
    readingMaps,
    { kind: "lesson", lesson: 1 },
    now,
  );

  it("removes only the chosen module", () => {
    const store = resetModuleProgress(both, "problem-solving");

    expect(Object.keys(store.modules)).toEqual(["reading-maps"]);
  });

  it("removes every module", () => {
    expect(resetAllProgress()).toEqual({ schema: 1, modules: {} });
  });
});

describe("choosing where Continue goes", () => {
  const problemSolving = { id: "problem-solving", version: "1" };
  const readingMaps = { id: "reading-maps", version: "1" };
  const store = recordStep(
    recordStep(
      EMPTY_PROGRESS,
      problemSolving,
      { kind: "lesson", lesson: 2 },
      "2026-10-01T09:00:00.000Z",
    ),
    readingMaps,
    { kind: "lesson", lesson: 1 },
    "2026-10-02T09:00:00.000Z",
  );

  it("picks the most recently used module", () => {
    expect(continueTarget(store, [problemSolving, readingMaps])?.moduleId).toBe(
      "reading-maps",
    );
  });

  it("skips modules no longer on the device or saved against an old version", () => {
    const target = continueTarget(store, [{ id: "problem-solving", version: "1" }]);
    expect(target?.moduleId).toBe("problem-solving");

    expect(continueTarget(store, [{ id: "problem-solving", version: "2" }])).toBeNull();
  });
});
