import type { Question } from "@/features/modules/module-types";
import type { Step } from "@/features/progress/progress-types";

export function isAnswered(answer: string | undefined): boolean {
  return answer !== undefined && answer.trim() !== "";
}

/** 1-based numbers of the Questions still without an answer. */
export function unansweredQuestions(
  questions: readonly Question[],
  answers: Readonly<Record<string, string>>,
): number[] {
  return questions.flatMap((question, index) =>
    isAnswered(answers[question.id]) ? [] : [index + 1],
  );
}

/** Previous/Next targets for a 1-based Question; the last one offers Submit. */
export function quizNavigation(
  current: number,
  total: number,
): { previous: number | null; next: number | null; isLast: boolean } {
  const isLast = current >= total;
  return {
    previous: current > 1 ? current - 1 : null,
    next: isLast ? null : current + 1,
    isLast,
  };
}

/** The Question a Quiz opens on: the saved one when the place is in the Quiz. */
export function startingQuestion(step: Step | undefined, total: number): number {
  if (step?.kind !== "quiz") return 1;
  return Math.min(Math.max(step.question, 1), Math.max(total, 1));
}
