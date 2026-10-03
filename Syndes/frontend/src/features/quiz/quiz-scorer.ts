import { use } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getActiveAccountId } from "@/lib/active-account";

export type QuestionStatus = "correct" | "incorrect" | "unanswered";

export type ScoreResult = {
  correct: number;
  total: number;
  questions: { questionId: string; status: QuestionStatus }[];
};

/** Scoring happens behind this port, never inside components. */
export interface QuizScorer {
  score(moduleId: string, answers: Record<string, string>): Promise<ScoreResult>;
}

type NativeScore = {
  correctCount: number;
  totalCount: number;
  perQuestion: { questionId: string; correct: boolean }[];
};

/** The Rust core owns normalization, hashing, and answer checks. */
export const desktopQuizScorer: QuizScorer = {
  async score(moduleId, answers) {
    const result = await invoke<NativeScore>("score_submission", {
      moduleId,
      answers: Object.entries(answers).map(([questionId, rawAnswer]) => ({ questionId, rawAnswer })),
    });
    return {
      correct: result.correctCount,
      total: result.totalCount,
      questions: result.perQuestion.map((entry) => ({
        questionId: entry.questionId,
        status: !answers[entry.questionId]?.trim() ? "unanswered" : entry.correct ? "correct" : "incorrect",
      })),
    };
  },
};

export function useQuizScorer(): QuizScorer {
  return desktopQuizScorer;
}

const scores = new Map<string, Promise<ScoreResult>>();

/** Suspends until the saved answers are scored. Use inside LocalDataBoundary. */
export function useScore(moduleId: string, answers: Record<string, string>): ScoreResult {
  const key = `${getActiveAccountId()}:${moduleId}:${JSON.stringify(Object.entries(answers).sort())}`;
  let pending = scores.get(key);
  if (!pending) {
    pending = desktopQuizScorer.score(moduleId, answers).catch((error: unknown) => {
      scores.delete(key);
      throw error;
    });
    scores.set(key, pending);
  }
  return use(pending);
}
