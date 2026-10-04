import { use } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getActiveAccountId } from "@/lib/active-account";
import { fixtureQuizScorer } from "./fixture-quiz-scorer";
import { tauriQuizScorer } from "./tauri-quiz-scorer";

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

/** Native scoring stays in Rust; the browser preview scores fixture content only. */
const activeScorer: QuizScorer = isTauri() ? tauriQuizScorer : fixtureQuizScorer;

export function useQuizScorer(): QuizScorer {
  return activeScorer;
}

const scores = new Map<string, Promise<ScoreResult>>();

/** Suspends until the saved answers are scored. Use inside LocalDataBoundary. */
export function useScore(moduleId: string, answers: Record<string, string>): ScoreResult {
  const key = `${getActiveAccountId()}:${moduleId}:${JSON.stringify(Object.entries(answers).sort())}`;
  let pending = scores.get(key);
  if (!pending) {
    pending = activeScorer.score(moduleId, answers).catch((error: unknown) => {
      scores.delete(key);
      throw error;
    });
    scores.set(key, pending);
  }
  return use(pending);
}
