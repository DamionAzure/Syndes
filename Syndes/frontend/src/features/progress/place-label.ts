import type { Step } from "./progress-types";

type PlaceCounts = { lessonCount: number; questionCount: number };

/** The Learner's place in words, e.g. "Lesson 2 of 6" or "Question 3 of 5". */
export function placeLabel(step: Step, counts: PlaceCounts): string {
  switch (step.kind) {
    case "overview":
      return "Module overview";
    case "lesson":
      return `Lesson ${step.lesson} of ${counts.lessonCount}`;
    case "quiz":
      return `Question ${step.question} of ${counts.questionCount}`;
    case "result":
      return "Quiz result";
  }
}

/** The same place as a position for a progress bar. */
export function placePosition(step: Step, counts: PlaceCounts): { current: number; total: number } {
  switch (step.kind) {
    case "overview":
      return { current: 0, total: counts.lessonCount };
    case "lesson":
      return { current: step.lesson, total: counts.lessonCount };
    case "quiz":
      return { current: step.question, total: counts.questionCount };
    case "result":
      return { current: 1, total: 1 };
  }
}
