import {
  activeAssignment,
  activeEnrollment,
  classLabel,
  findAccount,
  findClass,
  findSection,
  fullName,
  sectionLabel,
} from "./directory";
import type { Account, ActivityAction, Directory, Enrollment } from "./directory-types";

/**
 * Every Administrator change as a pure function: Directory in, Directory out,
 * with one activity entry appended. The same rules run server-side in the
 * admin-only Supabase functions (migration 0004); these exist so the screens
 * can say exactly why a change is not allowed.
 */

export type ActionContext = { actorId: string; now: string; newId: () => string };

export type ActionResult = { ok: true; directory: Directory; message: string } | { ok: false; message: string };

function fail(message: string): ActionResult {
  return { ok: false, message };
}

function done(
  directory: Directory,
  context: ActionContext,
  action: ActivityAction,
  subjectId: string,
  summary: string,
): ActionResult {
  return {
    ok: true,
    message: summary,
    directory: {
      ...directory,
      activity: [
        { id: context.newId(), at: context.now, actorId: context.actorId, action, subjectId, summary },
        ...directory.activity,
      ],
    },
  };
}

function updateAccount(directory: Directory, id: string, change: Partial<Account>): Directory {
  return {
    ...directory,
    accounts: directory.accounts.map((account) => (account.id === id ? { ...account, ...change } : account)),
  };
}

function activeAccount(directory: Directory, id: string): Account | string {
  const account = findAccount(directory, id);
  if (!account) return "That account no longer exists.";
  if (account.status === "removed") return `${fullName(account)}'s access was removed. Restore it first.`;
  return account;
}

// --- Teacher access ---

export function grantTeacherAccess(directory: Directory, accountId: string, context: ActionContext): ActionResult {
  const account = activeAccount(directory, accountId);
  if (typeof account === "string") return fail(account);
  if (account.role !== "student") return fail(`${fullName(account)} already has ${account.role === "teacher" ? "Teacher" : "Administrator"} access.`);
  if (activeEnrollment(directory, accountId)) {
    return fail(`${fullName(account)} is enrolled as a Learner. Remove them from their section first.`);
  }
  return done(
    updateAccount(directory, accountId, { role: "teacher", lrn: null }),
    context,
    "teacher-access-granted",
    accountId,
    `Gave ${fullName(account)} Teacher access.`,
  );
}

function endAssignments(directory: Directory, teacherId: string, now: string): Directory {
  return {
    ...directory,
    assignments: directory.assignments.map((assignment) =>
      assignment.teacherId === teacherId && assignment.endedAt === null ? { ...assignment, endedAt: now } : assignment,
    ),
  };
}

/** The Teacher keeps their account and can still sign in to Learn; their Classes become unassigned. */
export function removeTeacherAccess(directory: Directory, accountId: string, context: ActionContext): ActionResult {
  const account = activeAccount(directory, accountId);
  if (typeof account === "string") return fail(account);
  if (account.role !== "teacher") return fail(`${fullName(account)} does not have Teacher access.`);
  const next = updateAccount(endAssignments(directory, accountId, context.now), accountId, { role: "student" });
  return done(next, context, "teacher-access-removed", accountId, `Removed Teacher access from ${fullName(account)}.`);
}

export function assignTeacher(
  directory: Directory,
  input: { classId: string; teacherId: string },
  context: ActionContext,
): ActionResult {
  const schoolClass = findClass(directory, input.classId);
  if (!schoolClass) return fail("That class no longer exists.");
  const teacher = activeAccount(directory, input.teacherId);
  if (typeof teacher === "string") return fail(teacher);
  if (teacher.role !== "teacher") return fail(`${fullName(teacher)} needs Teacher access before they can be assigned.`);
  const current = activeAssignment(directory, input.classId);
  if (current?.teacherId === input.teacherId) return fail(`${fullName(teacher)} already teaches this class.`);

  const assignments = directory.assignments.map((assignment) =>
    assignment === current ? { ...assignment, endedAt: context.now } : assignment,
  );
  const next: Directory = {
    ...directory,
    assignments: [
      ...assignments,
      { id: context.newId(), classId: input.classId, teacherId: input.teacherId, startedAt: context.now, endedAt: null },
    ],
  };
  const replaced = current ? findAccount(directory, current.teacherId) : undefined;
  const label = classLabel(directory, schoolClass);
  return done(
    next,
    context,
    "teacher-assigned",
    input.classId,
    replaced
      ? `Assigned ${fullName(teacher)} to ${label}, replacing ${fullName(replaced)}.`
      : `Assigned ${fullName(teacher)} to ${label}.`,
  );
}

export function unassignTeacher(directory: Directory, classId: string, context: ActionContext): ActionResult {
  const schoolClass = findClass(directory, classId);
  const current = activeAssignment(directory, classId);
  if (!schoolClass || !current) return fail("This class has no teacher assigned.");
  const teacher = findAccount(directory, current.teacherId);
  const next: Directory = {
    ...directory,
    assignments: directory.assignments.map((assignment) =>
      assignment === current ? { ...assignment, endedAt: context.now } : assignment,
    ),
  };
  return done(
    next,
    context,
    "teacher-unassigned",
    classId,
    `Unassigned ${teacher ? fullName(teacher) : "the teacher"} from ${classLabel(directory, schoolClass)}.`,
  );
}

// --- Learner access ---

function endEnrollment(directory: Directory, enrollment: Enrollment, status: Enrollment["status"], now: string): Directory {
  return {
    ...directory,
    enrollments: directory.enrollments.map((entry) =>
      entry === enrollment ? { ...entry, status, endedAt: now } : entry,
    ),
  };
}

/** Enrolls a Learner, or moves them when they are already in another Section. */
export function enrollLearner(
  directory: Directory,
  input: { learnerId: string; sectionId: string },
  context: ActionContext,
): ActionResult {
  const learner = activeAccount(directory, input.learnerId);
  if (typeof learner === "string") return fail(learner);
  if (learner.role !== "student") {
    return fail(`${fullName(learner)} has ${learner.role === "teacher" ? "Teacher" : "Administrator"} access and cannot be enrolled.`);
  }
  const section = findSection(directory, input.sectionId);
  if (!section) return fail("That section no longer exists.");
  const current = activeEnrollment(directory, input.learnerId);
  if (current?.sectionId === input.sectionId) return fail(`${fullName(learner)} is already in ${sectionLabel(section)}.`);

  const base = current ? endEnrollment(directory, current, "moved", context.now) : directory;
  const next: Directory = {
    ...base,
    enrollments: [
      ...base.enrollments,
      {
        id: context.newId(),
        learnerId: input.learnerId,
        sectionId: input.sectionId,
        status: "enrolled",
        startedAt: context.now,
        endedAt: null,
      },
    ],
  };
  const from = current ? findSection(directory, current.sectionId) : undefined;
  return from
    ? done(next, context, "learner-moved", input.learnerId, `Moved ${fullName(learner)} from ${sectionLabel(from)} to ${sectionLabel(section)}.`)
    : done(next, context, "learner-enrolled", input.learnerId, `Enrolled ${fullName(learner)} in ${sectionLabel(section)}.`);
}

export type LeaveReason = "dropped" | "transferred";

/** Ends a Learner's enrollment; the reason feeds the drop rate, so it is required. */
export function removeLearnerFromSection(
  directory: Directory,
  input: { learnerId: string; reason: LeaveReason },
  context: ActionContext,
): ActionResult {
  const learner = findAccount(directory, input.learnerId);
  const current = activeEnrollment(directory, input.learnerId);
  if (!learner || !current) return fail("This learner is not enrolled in a section.");
  const section = findSection(directory, current.sectionId);
  const where = section ? sectionLabel(section) : "their section";
  const next = endEnrollment(directory, current, input.reason, context.now);
  return input.reason === "dropped"
    ? done(next, context, "learner-dropped", input.learnerId, `Recorded ${fullName(learner)} as dropped from ${where}.`)
    : done(next, context, "learner-transferred", input.learnerId, `Recorded ${fullName(learner)} as transferred out of ${where}.`);
}

// --- Whole-account access ---

/** Signing in stops granting anything. Enrollments must be closed first so the reason is recorded. */
export function removeAccess(directory: Directory, accountId: string, context: ActionContext): ActionResult {
  const account = activeAccount(directory, accountId);
  if (typeof account === "string") return fail(account);
  if (accountId === context.actorId) return fail("You cannot remove your own access.");
  if (account.role === "admin") return fail("Administrator access is changed by the school's system owner, not here.");
  if (activeEnrollment(directory, accountId)) {
    return fail(`Remove ${fullName(account)} from their section first, and record whether they dropped or transferred.`);
  }
  const next = updateAccount(endAssignments(directory, accountId, context.now), accountId, { status: "removed" });
  return done(next, context, "access-removed", accountId, `Removed all access for ${fullName(account)}.`);
}

/** Restored accounts come back with Learn only; Teacher access and Sections are given again on purpose. */
export function restoreAccess(directory: Directory, accountId: string, context: ActionContext): ActionResult {
  const account = findAccount(directory, accountId);
  if (!account) return fail("That account no longer exists.");
  if (account.status !== "removed") return fail(`${fullName(account)} already has access.`);
  return done(
    updateAccount(directory, accountId, { status: "active", role: "student" }),
    context,
    "access-restored",
    accountId,
    `Restored access for ${fullName(account)}. They are waiting to be placed.`,
  );
}

// --- Sections and classes ---

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createSection(
  directory: Directory,
  input: { gradeLevel: string; name: string },
  context: ActionContext,
): ActionResult {
  const name = input.name.trim();
  const gradeLevel = input.gradeLevel.trim();
  if (!gradeLevel) return fail("Choose a grade level.");
  if (!name) return fail("Give the section a name.");
  const duplicate = directory.sections.some(
    (section) => section.gradeLevel === gradeLevel && section.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) return fail(`${gradeLevel} ${name} already exists.`);
  const id = `${slug(gradeLevel)}-${slug(name)}-${context.newId().slice(0, 6)}`;
  return done(
    { ...directory, sections: [...directory.sections, { id, gradeLevel, name }] },
    context,
    "section-created",
    id,
    `Created ${gradeLevel} ${name}.`,
  );
}

export function addClass(
  directory: Directory,
  input: { sectionId: string; learningArea: string },
  context: ActionContext,
): ActionResult {
  const section = findSection(directory, input.sectionId);
  const learningArea = input.learningArea.trim();
  if (!section) return fail("That section no longer exists.");
  if (!learningArea) return fail("Choose a learning area.");
  const duplicate = directory.classes.some(
    (schoolClass) =>
      schoolClass.sectionId === input.sectionId && schoolClass.learningArea.toLowerCase() === learningArea.toLowerCase(),
  );
  if (duplicate) return fail(`${sectionLabel(section)} already has ${learningArea}.`);
  const id = `${input.sectionId}-${slug(learningArea)}`;
  return done(
    { ...directory, classes: [...directory.classes, { id, sectionId: input.sectionId, learningArea }] },
    context,
    "class-added",
    id,
    `Added ${learningArea} to ${sectionLabel(section)}.`,
  );
}
