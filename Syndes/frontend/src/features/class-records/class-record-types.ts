/**
 * What a Teacher sees about the Learners they teach. Every record here is
 * reported to the Teacher; nothing is derived from this device's Progress.
 */

export type Section = {
  id: string;
  /** e.g. "Grade 6" */
  gradeLevel: string;
  /** e.g. "Sampaguita" */
  name: string;
};

/** Which DepEd component weights a learning area uses. */
export type WeightGroup = "languages" | "science-math" | "skills";

/** One Section taught one learning area by this Teacher. */
export type SchoolClass = {
  id: string;
  sectionId: string;
  learningArea: string;
  weightGroup: WeightGroup;
};

export type Guardian = {
  name: string;
  relationship: string;
  contact: string;
};

export type Learner = {
  id: string;
  /** Learner Reference Number. */
  lrn: string;
  givenName: string;
  familyName: string;
  sectionId: string;
  guardian: Guardian;
};

/** A Learner's Progress and Result in one Module, as last reported from their device. */
export type ReportedModule = {
  learnerId: string;
  moduleId: string;
  moduleTitle: string;
  lessonCount: number;
  /** 0 until the first Lesson is opened. */
  lessonsReached: number;
  /** 0 when the Module has no Quiz. */
  questionCount: number;
  /** Present once the Quiz is submitted. */
  result: { correct: number; total: number; submittedAt: string } | null;
  reportedAt: string;
};

export type Quarter = 1 | 2 | 3 | 4;

export const QUARTERS: readonly Quarter[] = [1, 2, 3, 4];

/** Raw total for one grading component in a quarter. */
export type ComponentScore = { score: number; highest: number };

export type GradeRecord = {
  learnerId: string;
  classId: string;
  quarter: Quarter;
  writtenWork: ComponentScore;
  performanceTasks: ComponentScore;
  /** null until the quarterly assessment has been given. */
  quarterlyAssessment: ComponentScore | null;
};
