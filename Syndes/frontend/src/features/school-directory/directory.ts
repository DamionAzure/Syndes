import type {
  AccessState,
  Account,
  ActivityAction,
  Directory,
  Enrollment,
  EnrollmentStatus,
  SchoolClass,
  Section,
  TeacherAssignment,
} from "./directory-types";

/** Read-only questions about the Directory. Every screen derives from these. */

export function fullName(account: Pick<Account, "givenName" | "familyName">): string {
  return `${account.givenName} ${account.familyName}`;
}

export function listName(account: Pick<Account, "givenName" | "familyName">): string {
  return `${account.familyName}, ${account.givenName}`;
}

export function byFamilyName(a: Account, b: Account): number {
  return a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName);
}

export function sectionLabel(section: Pick<Section, "gradeLevel" | "name">): string {
  return `${section.gradeLevel} ${section.name}`;
}

export function findAccount(directory: Directory, id: string | null): Account | undefined {
  return id ? directory.accounts.find((account) => account.id === id) : undefined;
}

export function findSection(directory: Directory, id: string): Section | undefined {
  return directory.sections.find((section) => section.id === id);
}

export function findClass(directory: Directory, id: string): SchoolClass | undefined {
  return directory.classes.find((schoolClass) => schoolClass.id === id);
}

export function classLabel(directory: Directory, schoolClass: SchoolClass): string {
  const section = findSection(directory, schoolClass.sectionId);
  return section ? `${schoolClass.learningArea}, ${sectionLabel(section)}` : schoolClass.learningArea;
}

export function activeEnrollment(directory: Directory, learnerId: string): Enrollment | undefined {
  return directory.enrollments.find((enrollment) => enrollment.learnerId === learnerId && enrollment.endedAt === null);
}

export function activeAssignment(directory: Directory, classId: string): TeacherAssignment | undefined {
  return directory.assignments.find((assignment) => assignment.classId === classId && assignment.endedAt === null);
}

export function classesTaughtBy(directory: Directory, teacherId: string): SchoolClass[] {
  const classIds = new Set(
    directory.assignments
      .filter((assignment) => assignment.teacherId === teacherId && assignment.endedAt === null)
      .map((assignment) => assignment.classId),
  );
  return directory.classes.filter((schoolClass) => classIds.has(schoolClass.id));
}

export function learnersIn(directory: Directory, sectionId: string): Account[] {
  const ids = new Set(
    directory.enrollments
      .filter((enrollment) => enrollment.sectionId === sectionId && enrollment.endedAt === null)
      .map((enrollment) => enrollment.learnerId),
  );
  return directory.accounts.filter((account) => ids.has(account.id)).sort(byFamilyName);
}

export function classesIn(directory: Directory, sectionId: string): SchoolClass[] {
  return directory.classes
    .filter((schoolClass) => schoolClass.sectionId === sectionId)
    .sort((a, b) => a.learningArea.localeCompare(b.learningArea));
}

/**
 * What an Account can do now. A signed-in Student with no Section is waiting:
 * signing in alone grants nothing until an Administrator places them (ADR-0004).
 */
export function accessStateOf(directory: Directory, account: Account): AccessState {
  if (account.status === "removed") return "removed";
  if (account.role === "admin") return "admin";
  if (account.role === "teacher") return "teacher";
  if (activeEnrollment(directory, account.id)) return "learner";
  return directory.enrollments.some((enrollment) => enrollment.learnerId === account.id) ? "unenrolled" : "waiting";
}

export const ACCESS_LABEL: Record<AccessState, string> = {
  learner: "Learner",
  teacher: "Teacher",
  admin: "Administrator",
  waiting: "Waiting for access",
  unenrolled: "Not in a section",
  removed: "Access removed",
};

export const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
  enrolled: "Enrolled",
  moved: "Moved to another section",
  dropped: "Dropped",
  transferred: "Transferred out",
};

export const ACTIVITY_LABEL: Record<ActivityAction, string> = {
  "teacher-access-granted": "Teacher access given",
  "teacher-access-removed": "Teacher access removed",
  "teacher-assigned": "Teacher assigned",
  "teacher-unassigned": "Teacher unassigned",
  "learner-enrolled": "Learner enrolled",
  "learner-moved": "Learner moved",
  "learner-dropped": "Learner dropped",
  "learner-transferred": "Learner transferred out",
  "access-removed": "Access removed",
  "access-restored": "Access restored",
  "section-created": "Section created",
  "class-added": "Class added",
};

/** Sections in school order: grade level, then name. */
export function sortedSections(directory: Directory): Section[] {
  return [...directory.sections].sort(
    (a, b) => a.gradeLevel.localeCompare(b.gradeLevel, undefined, { numeric: true }) || a.name.localeCompare(b.name),
  );
}

export function timestampLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
