import type { Step } from "@/features/progress/progress-types";

/**
 * Every learner route, built in one place. Module IDs travel in search params
 * so the routes stay static-exportable (ADR-0001).
 */
function withParams(path: string, params: Record<string, string | number>) {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  return `${path}?${query.toString()}`;
}

export const routes = {
  home: () => "/",
  library: () => "/modules",
  module: (moduleId: string) => withParams("/module", { module: moduleId }),
  lesson: (moduleId: string, lesson: number) =>
    withParams("/lesson", { module: moduleId, lesson }),
  quizzes: () => "/quizzes",
  quiz: (moduleId: string) => withParams("/quiz", { module: moduleId }),
  result: (moduleId: string) => withParams("/quiz/result", { module: moduleId }),
  flashcards: (moduleId: string) =>
    withParams("/flashcards", { module: moduleId }),
  progress: () => "/progress",
  settings: () => "/settings",
};

/** Where Continue takes the Learner for a saved Step. */
export function hrefForStep(moduleId: string, step: Step): string {
  switch (step.kind) {
    case "overview":
      return routes.module(moduleId);
    case "lesson":
      return routes.lesson(moduleId, step.lesson);
    case "quiz":
      return routes.quiz(moduleId);
    case "result":
      return routes.result(moduleId);
  }
}
