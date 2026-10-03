import type { Step } from "./progress-types";

/** The Learner's place in words, e.g. "Lesson 2 of 6" or "Question 3 of 5". */
export function placeLabel(
  step: Step,
  counts: { lessonCount: number; questionCount: number },
): string {
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
