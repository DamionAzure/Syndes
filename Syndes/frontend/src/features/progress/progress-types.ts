export type Step =
  | { kind: "overview" }
  /** 1-based lesson number. */
  | { kind: "lesson"; lesson: number }
  /** 1-based question number. */
  | { kind: "quiz"; question: number }
  | { kind: "result" };

/** A Learner's saved place in one Module, kept on this device only. */
export type ModuleProgress = {
  moduleId: string;
  contentVersion: string;
  step: Step;
  /** questionId → chosen option id, or the entered text. */
  answers: Record<string, string>;
  finalLessonReached: boolean;
  quizSubmitted: boolean;
  /** ISO time; the latest entry is the Continue target. */
  updatedAt: string;
};

export type ProgressStore = {
  schema: 1;
  modules: Record<string, ModuleProgress>;
};
