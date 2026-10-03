/**
 * Student view model for a Module. It deliberately has no answer fields:
 * correctness exists only behind the QuizScorer port.
 */
export type ModuleSummary = {
  id: string;
  /** Content version; a change invalidates saved Progress. */
  version: string;
  subject: string;
  title: string;
  summary: string;
  lessonCount: number;
  /** 0 when the Module has no Quiz. */
  questionCount: number;
  hasFlashcards: boolean;
  /** A fact reported by the source, never assumed by the UI. */
  readyOffline: boolean;
};

export type LessonSection = {
  heading: string;
  paragraphs: string[];
  tryThis?: string[];
};

export type Lesson = {
  id: string;
  title: string;
  subtitle?: string;
  minutes: number;
  sections: LessonSection[];
  /** Margin notes shown under "Remember". */
  remember?: string[];
};

export type ChoiceOption = { id: string; label: string };

export type Question =
  | { id: string; kind: "choice"; prompt: string; options: ChoiceOption[] }
  | { id: string; kind: "text"; prompt: string };

export type Quiz = { questions: Question[] };

export type Flashcard = { id: string; front: string; back: string };

export type Module = ModuleSummary & {
  outcomes: string[];
  lessons: Lesson[];
  quiz?: Quiz;
  flashcards?: Flashcard[];
};
