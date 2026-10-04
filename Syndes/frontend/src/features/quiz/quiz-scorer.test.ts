import { beforeEach, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => invoke.mockReset());

it("scores saved answers through the desktop core and reports per-Question review", async () => {
  invoke.mockResolvedValue({
    correctCount: 1,
    totalCount: 2,
    pointsEarned: 1,
    pointsPossible: 2,
    perQuestion: [
      { questionId: "q1", correct: true, points: 1 },
      { questionId: "q2", correct: false, points: 0 },
    ],
  });
  const { tauriQuizScorer } = await import("./tauri-quiz-scorer");
  expect(await tauriQuizScorer.score("mod_science", { q1: "True", q2: "" })).toEqual({
    correct: 1,
    total: 2,
    questions: [
      { questionId: "q1", status: "correct" },
      { questionId: "q2", status: "unanswered" },
    ],
  });
  expect(invoke).toHaveBeenCalledWith("score_submission", {
    moduleId: "mod_science",
    answers: [{ questionId: "q1", rawAnswer: "True" }, { questionId: "q2", rawAnswer: "" }],
  });
});
