import { use } from "react";
import type {
  GradeRecord,
  Learner,
  ReportedModule,
  SchoolClass,
  Section,
} from "./class-record-types";
import {
  FIXTURE_CLASSES,
  FIXTURE_GRADE_RECORDS,
  FIXTURE_LEARNERS,
  FIXTURE_REPORTED_MODULES,
  FIXTURE_SECTIONS,
} from "./fixture-class-records";

export type ClassRecords = {
  sections: Section[];
  classes: SchoolClass[];
  learners: Learner[];
  reports: ReportedModule[];
  grades: GradeRecord[];
  /** True while the records are sample data rather than reported ones. */
  sample: boolean;
};

/**
 * Where a Teacher's records come from. Records must be read through a
 * trusted, authorized boundary once real Learner data exists (ADR-0004);
 * until then the sample source stands in.
 */
export interface ClassRecordSource {
  read(): Promise<ClassRecords>;
}

const sampleSource: ClassRecordSource = {
  read: async () => ({
    sections: FIXTURE_SECTIONS,
    classes: FIXTURE_CLASSES,
    learners: FIXTURE_LEARNERS,
    reports: FIXTURE_REPORTED_MODULES,
    grades: FIXTURE_GRADE_RECORDS,
    sample: true,
  }),
};

/** The one place the active source is chosen. */
const activeSource: ClassRecordSource = sampleSource;

let pending: Promise<ClassRecords> | null = null;

/** Suspends until the records are read. Use inside LocalDataBoundary. */
export function useClassRecords(): ClassRecords {
  pending ??= activeSource.read();
  return use(pending);
}

export function sectionLabel(section: Section): string {
  return `${section.gradeLevel} ${section.name}`;
}

export function classLabel(schoolClass: SchoolClass, sections: readonly Section[]): string {
  const section = sections.find((candidate) => candidate.id === schoolClass.sectionId);
  return section ? `${schoolClass.learningArea}, ${sectionLabel(section)}` : schoolClass.learningArea;
}
