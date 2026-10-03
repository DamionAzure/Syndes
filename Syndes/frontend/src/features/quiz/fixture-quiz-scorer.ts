/**
 * FIXTURE ONLY. Expected answers for the made-up demo content in
 * features/modules/fixture-modules.ts, so the Quiz and Result screens can be
 * built before the real scorer exists. It must never score real modules: the
 * Tauri bridge replaces it in quiz-scorer.ts.
 */
import type { QuizScorer, ScoreResult } from "./quiz-scorer";

const FIXTURE_EXPECTED: Record<string, readonly (readonly [string, string])[]> = {
  "problem-solving": [
    ["ps-q1", "a"],
    ["ps-q2", "b"],
    ["ps-q3", "b"],
    ["ps-q4", "false"],
    ["ps-q5", "goal"],
  ],
  photosynthesis: [
    ["ph-q1", "carbon dioxide"],
    ["ph-q2", "a"],
    ["ph-q3", "true"],
  ],
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export const fixtureQuizScorer: QuizScorer = {
  async score(moduleId, answers): Promise<ScoreResult> {
    const expected = FIXTURE_EXPECTED[moduleId] ?? [];
    const questions = expected.map(([questionId, key]) => {
      const answer = normalize(answers[questionId] ?? "");
      const status =
        answer === "" ? "unanswered" : answer === key ? "correct" : "incorrect";
      return { questionId, status } as const;
    });
    return {
      correct: questions.filter((question) => question.status === "correct").length,
      total: questions.length,
      questions,
    };
  },
};
