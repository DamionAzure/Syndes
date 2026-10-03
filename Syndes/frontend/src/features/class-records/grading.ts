import type { ComponentScore, GradeRecord, Learner, ReportedModule, WeightGroup } from "./class-record-types";

/**
 * Quarterly grades follow DepEd Order No. 8, s. 2015 for Grades 1–10:
 * percentage score per component, weighted, summed into an initial grade,
 * then transmuted so that an initial grade of 60 reports as 75.
 */

export type Weights = {
  writtenWork: number;
  performanceTasks: number;
  quarterlyAssessment: number;
};

export const WEIGHTS: Record<WeightGroup, Weights> = {
  languages: { writtenWork: 30, performanceTasks: 50, quarterlyAssessment: 20 },
  "science-math": { writtenWork: 40, performanceTasks: 40, quarterlyAssessment: 20 },
  skills: { writtenWork: 20, performanceTasks: 60, quarterlyAssessment: 20 },
};

export const PASSING_GRADE = 75;

/** Rounded to two decimals, as the class record shows it. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function percentageScore({ score, highest }: ComponentScore): number {
  if (highest <= 0) return 0;
  return round2((Math.min(Math.max(score, 0), highest) / highest) * 100);
}

/**
 * The transmutation table, computed in hundredths so range edges are exact:
 * 60.00–61.59 → 75, then one step per 1.60 up to 100; below 60, one step
 * per 4.00 down to 60.
 */
export function transmute(initialGrade: number): number {
  const hundredths = Math.round(Math.min(Math.max(initialGrade, 0), 100) * 100);
  if (hundredths >= 6000) return Math.min(100, 75 + Math.floor((hundredths - 6000) / 160));
  return 60 + Math.floor(hundredths / 400);
}

export type Descriptor =
  | "Outstanding"
  | "Very satisfactory"
  | "Satisfactory"
  | "Fairly satisfactory"
  | "Did not meet expectations";

export function descriptorFor(quarterlyGrade: number): Descriptor {
  if (quarterlyGrade >= 90) return "Outstanding";
  if (quarterlyGrade >= 85) return "Very satisfactory";
  if (quarterlyGrade >= 80) return "Satisfactory";
  if (quarterlyGrade >= 75) return "Fairly satisfactory";
  return "Did not meet expectations";
}

export type ComputedGrade =
  | {
      status: "final";
      writtenWork: number;
      performanceTasks: number;
      quarterlyAssessment: number;
      initialGrade: number;
      quarterlyGrade: number;
      descriptor: Descriptor;
    }
  | {
      /** The quarterly assessment has not been given, so there is no grade yet. */
      status: "incomplete";
      writtenWork: number;
      performanceTasks: number;
    };

export function computeGrade(record: GradeRecord, group: WeightGroup): ComputedGrade {
  const weights = WEIGHTS[group];
  const writtenWork = percentageScore(record.writtenWork);
  const performanceTasks = percentageScore(record.performanceTasks);
  if (!record.quarterlyAssessment) return { status: "incomplete", writtenWork, performanceTasks };

  const quarterlyAssessment = percentageScore(record.quarterlyAssessment);
  const initialGrade = round2(
    (writtenWork * weights.writtenWork +
      performanceTasks * weights.performanceTasks +
      quarterlyAssessment * weights.quarterlyAssessment) /
      100,
  );
  const quarterlyGrade = transmute(initialGrade);
  return {
    status: "final",
    writtenWork,
    performanceTasks,
    quarterlyAssessment,
    initialGrade,
    quarterlyGrade,
    descriptor: descriptorFor(quarterlyGrade),
  };
}

export function fullName(learner: Pick<Learner, "familyName" | "givenName">): string {
  return `${learner.givenName} ${learner.familyName}`;
}

/** Class-record order: family name, then given name. */
export function byFamilyName(a: Learner, b: Learner): number {
  return (
    a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName)
  );
}

export type ModuleStatus = "not-started" | "in-progress" | "completed";

/** Same rule Learners see: final Lesson reached and, when there is a Quiz, submitted. */
export function moduleStatus(report: ReportedModule): ModuleStatus {
  if (report.lessonsReached === 0 && !report.result) return "not-started";
  const finalLesson = report.lessonsReached >= report.lessonCount;
  const quizDone = report.questionCount === 0 || report.result !== null;
  return finalLesson && quizDone ? "completed" : "in-progress";
}

export const MODULE_STATUS_LABEL: Record<ModuleStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
};

/** Share of correct answers, 0–100, or null before the Quiz is submitted. */
export function resultPercent(report: ReportedModule): number | null {
  if (!report.result || report.result.total === 0) return null;
  return Math.round((report.result.correct / report.result.total) * 100);
}

/** A Result below this share is flagged for a Teacher's attention. */
export const LOW_RESULT_PERCENT = 60;
