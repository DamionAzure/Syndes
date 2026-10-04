/**
 * The REAL quiz scorer: the verdict comes only from the Rust core
 * (`score_submission`), never from JS (spec 01 R1/R2). It is selected over the
 * browser-only fixtureQuizScorer in quiz-scorer.ts whenever isTauri() is true.
 *
 * It maps the backend `ScoreResult` (model.rs camelCase) onto the quiz port's
 * LOCAL ScoreResult `{ correct, total, questions:{questionId,status}[] }`,
 * preserving the fixture scorer's "unanswered" distinction: whether a question
 * is "unanswered" is decided HERE on the JS side from the raw answer being
 * empty/whitespace (mirrors isAnswered in quiz-session.ts) BEFORE the backend
 * verdict is consulted. The backend scores empty answers as incorrect; the
 * display turns those empties into "unanswered" instead.
 *
 * ⚠️ LOAD PRECONDITION (documented, out of scope to fix here): `score_submission`
 * only resolves a module the Rust ModuleStore already holds (registered by
 * `load_module`/pullModule under `module.id`). The quiz screens pass
 * `useModuleParam().id`, which today comes from the fixtureModuleSource
 * (features/modules/module-source.ts), so those ids are NOT registered in the
 * Rust store. Until the module-source Tauri bridge lands, a real-module score
 * will reject with AppError::ModuleNotFound. That rejection degrades safely: the
 * submit() catch in quiz-view.tsx shows the "could not be scored on this device"
 * notice. No JS scoring fallback is added, by design.
 */
import { invoke } from "@tauri-apps/api/core";
import { isAnswered } from "./quiz-session";
import type { QuestionStatus, QuizScorer, ScoreResult } from "./quiz-scorer";

/** `CheckResult` from src-tauri/src/model.rs (serde camelCase). */
interface BackendCheckResult {
  questionId: string;
  correct: boolean;
  points: number;
}

/** `ScoreResult` from src-tauri/src/model.rs (serde camelCase). */
interface BackendScoreResult {
  correctCount: number;
  totalCount: number;
  pointsEarned: number;
  pointsPossible: number;
  perQuestion: BackendCheckResult[];
}

function isBackendCheckResult(raw: unknown): raw is BackendCheckResult {
  if (typeof raw !== "object" || raw === null) return false;
  const record = raw as Record<string, unknown>;
  return (
    typeof record["questionId"] === "string" &&
    typeof record["correct"] === "boolean" &&
    typeof record["points"] === "number"
  );
}

function parseBackendScoreResult(raw: unknown): BackendScoreResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("score_submission returned an unexpected payload");
  }
  const record = raw as Record<string, unknown>;
  const perQuestion = record["perQuestion"];
  if (!Array.isArray(perQuestion) || !perQuestion.every(isBackendCheckResult)) {
    throw new Error("score_submission returned an unexpected perQuestion payload");
  }
  return {
    correctCount: typeof record["correctCount"] === "number" ? record["correctCount"] : 0,
    totalCount: typeof record["totalCount"] === "number" ? record["totalCount"] : perQuestion.length,
    pointsEarned: typeof record["pointsEarned"] === "number" ? record["pointsEarned"] : 0,
    pointsPossible: typeof record["pointsPossible"] === "number" ? record["pointsPossible"] : 0,
    perQuestion,
  };
}

export const tauriQuizScorer: QuizScorer = {
  async score(moduleId, answers): Promise<ScoreResult> {
    // ONE batched round trip. Every entry is submitted (empty strings included):
    // the backend scores them, and the "unanswered" display distinction is
    // derived here, not by withholding the answer from the core.
    const submitted = Object.entries(answers).map(([questionId, rawAnswer]) => ({
      questionId,
      rawAnswer,
    }));

    const result = parseBackendScoreResult(
      await invoke<unknown>("score_submission", { moduleId, answers: submitted }),
    );

    // Map backend -> local shape, one entry per per-question verdict, in order.
    const questions = result.perQuestion.map((verdict) => {
      const raw = answers[verdict.questionId];
      const status: QuestionStatus = !isAnswered(raw)
        ? "unanswered"
        : verdict.correct
          ? "correct"
          : "incorrect";
      return { questionId: verdict.questionId, status };
    });

    return {
      // Derive from the per-question statuses so an empty answer can never count
      // as correct, independent of the backend's correctCount.
      correct: questions.filter((question) => question.status === "correct").length,
      total: questions.length,
      questions,
    };
  },
};
