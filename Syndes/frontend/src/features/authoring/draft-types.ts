/**
 * A Teacher's unsealed Module draft. Unlike the Learner view model it holds
 * correct answers in the clear, so it must never reach a Learner (ADR-0005).
 */

export type BlockKind = "heading" | "paragraph";

export type DraftBlock = { id: string; kind: BlockKind; text: string };

export type DraftLesson = {
  id: string;
  title: string;
  minutes: number;
  blocks: DraftBlock[];
};

export type QuestionKind = "multiple_choice" | "true_false" | "identification";

export type TrueFalse = "True" | "False";

export type DraftQuestion =
  | {
      id: string;
      kind: "multiple_choice";
      prompt: string;
      options: string[];
      /** Index into `options`; the option text is what gets sealed. */
      correctIndex: number | null;
      points: number;
    }
  | { id: string; kind: "true_false"; prompt: string; answer: TrueFalse | null; points: number }
  | { id: string; kind: "identification"; prompt: string; answer: string; points: number };

export type DraftFlashcard = { id: string; front: string; back: string };

/** What the Teacher chose to create; it only decides where the editor opens. */
export type DraftStart = "module" | "quiz" | "flashcards";

export type ModuleDraft = {
  id: string;
  start: DraftStart;
  title: string;
  subject: string;
  gradeLevel: string;
  summary: string;
  /** One learning outcome per line. */
  outcomes: string;
  lessons: DraftLesson[];
  questions: DraftQuestion[];
  flashcards: DraftFlashcard[];
  createdAt: string;
  updatedAt: string;
};

export type DraftStore = { schema: 1; drafts: Record<string, ModuleDraft> };

/** One page of the editor. Lessons are numbered from 1. */
export type DraftPart =
  | { kind: "details" }
  | { kind: "lesson"; lesson: number }
  | { kind: "quiz" }
  | { kind: "flashcards" };
