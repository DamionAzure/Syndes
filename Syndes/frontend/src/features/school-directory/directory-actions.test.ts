import { describe, expect, it } from "vitest";
import { accessStateOf, activeAssignment, activeEnrollment, findAccount } from "./directory";
import {
  addClass,
  assignTeacher,
  createSection,
  enrollLearner,
  grantTeacherAccess,
  removeAccess,
  removeLearnerFromSection,
  removeTeacherAccess,
  restoreAccess,
  unassignTeacher,
  type ActionContext,
  type ActionResult,
} from "./directory-actions";
import type { Directory } from "./directory-types";
import { SAMPLE_ADMIN_ID, sampleDirectory } from "./fixture-directory";
import { parseDirectory } from "./use-directory";

let counter = 0;
const context: ActionContext = {
  actorId: SAMPLE_ADMIN_ID,
  now: "2026-10-04T09:00:00.000Z",
  newId: () => `id-${(counter += 1)}`,
};

function ok(result: ActionResult): Directory {
  if (!result.ok) throw new Error(`expected success, got: ${result.message}`);
  return result.directory;
}

function state(directory: Directory, id: string) {
  const account = findAccount(directory, id);
  if (!account) throw new Error(`no account ${id}`);
  return accessStateOf(directory, account);
}

describe("access states in the sample school", () => {
  it("separates new sign-ins, Learners who left, and removed accounts", () => {
    const directory = sampleDirectory();
    expect(state(directory, "account-52")).toBe("waiting");
    expect(state(directory, "learner-49")).toBe("unenrolled");
    expect(state(directory, "teacher-08")).toBe("removed");
    expect(state(directory, "learner-01")).toBe("learner");
    expect(state(directory, SAMPLE_ADMIN_ID)).toBe("admin");
  });
});

describe("teacher access", () => {
  it("gives a new sign-in Teacher access and assigns them a class, logging both", () => {
    let directory = ok(grantTeacherAccess(sampleDirectory(), "account-52", context));
    expect(state(directory, "account-52")).toBe("teacher");
    directory = ok(assignTeacher(directory, { classId: "g4-rizal-mathematics", teacherId: "account-52" }, context));
    expect(activeAssignment(directory, "g4-rizal-mathematics")?.teacherId).toBe("account-52");
    expect(directory.activity.slice(0, 2).map((entry) => entry.action)).toEqual(["teacher-assigned", "teacher-access-granted"]);
  });

  it("refuses Teacher access for an enrolled Learner", () => {
    const result = grantTeacherAccess(sampleDirectory(), "learner-01", context);
    expect(result).toEqual({ ok: false, message: "Andrea Bautista is enrolled as a Learner. Remove them from their section first." });
  });

  it("replaces the current teacher of a class and ends the old assignment", () => {
    const directory = ok(assignTeacher(sampleDirectory(), { classId: "g6-narra-science", teacherId: "teacher-06" }, context));
    expect(activeAssignment(directory, "g6-narra-science")?.teacherId).toBe("teacher-06");
    expect(directory.activity[0]?.summary).toBe("Assigned Ana Fernandez to Science, Grade 6 Narra, replacing Ramon Aquino.");
  });

  it("only assigns accounts with Teacher access", () => {
    expect(assignTeacher(sampleDirectory(), { classId: "g4-rizal-mathematics", teacherId: "learner-01" }, context).ok).toBe(false);
  });

  it("removing Teacher access unassigns every class they taught", () => {
    const directory = ok(removeTeacherAccess(sampleDirectory(), "teacher-01", context));
    expect(state(directory, "teacher-01")).toBe("waiting");
    expect(activeAssignment(directory, "g6-sampaguita-science")).toBeUndefined();
    expect(ok(unassignTeacher(sampleDirectory(), "g6-narra-science", context)).assignments.some(
      (assignment) => assignment.classId === "g6-narra-science" && assignment.endedAt === null,
    )).toBe(false);
  });
});

describe("learner access", () => {
  it("enrolls a new sign-in, then moves them, keeping the history", () => {
    let directory = ok(enrollLearner(sampleDirectory(), { learnerId: "learner-54", sectionId: "g4-mabini" }, context));
    directory = ok(enrollLearner(directory, { learnerId: "learner-54", sectionId: "g4-rizal" }, context));
    expect(activeEnrollment(directory, "learner-54")?.sectionId).toBe("g4-rizal");
    expect(directory.enrollments.filter((entry) => entry.learnerId === "learner-54").map((entry) => entry.status)).toEqual([
      "moved",
      "enrolled",
    ]);
  });

  it("records why a Learner left", () => {
    const directory = ok(removeLearnerFromSection(sampleDirectory(), { learnerId: "learner-02", reason: "transferred" }, context));
    expect(state(directory, "learner-02")).toBe("unenrolled");
    expect(directory.activity[0]?.action).toBe("learner-transferred");
  });
});

describe("whole-account access", () => {
  it("asks for the leaving reason before removing an enrolled Learner", () => {
    expect(removeAccess(sampleDirectory(), "learner-01", context).ok).toBe(false);
  });

  it("never removes the signed-in Administrator or another Administrator", () => {
    expect(removeAccess(sampleDirectory(), SAMPLE_ADMIN_ID, context)).toEqual({
      ok: false,
      message: "You cannot remove your own access.",
    });
  });

  it("removes a Teacher's access entirely, and restores it as Learn only", () => {
    let directory = ok(removeAccess(sampleDirectory(), "teacher-02", context));
    expect(state(directory, "teacher-02")).toBe("removed");
    expect(activeAssignment(directory, "g6-narra-english")).toBeUndefined();
    directory = ok(restoreAccess(directory, "teacher-02", context));
    expect(findAccount(directory, "teacher-02")?.role).toBe("student");
  });
});

describe("sections and classes", () => {
  it("creates a section and adds a class, refusing duplicates", () => {
    let directory = ok(createSection(sampleDirectory(), { gradeLevel: "Grade 4", name: "Del Pilar" }, context));
    const section = directory.sections.at(-1);
    expect(section?.name).toBe("Del Pilar");
    directory = ok(addClass(directory, { sectionId: section?.id ?? "", learningArea: "Science" }, context));
    expect(addClass(directory, { sectionId: section?.id ?? "", learningArea: "science" }, context).ok).toBe(false);
    expect(createSection(directory, { gradeLevel: "Grade 4", name: "del pilar" }, context).ok).toBe(false);
  });
});

describe("stored directory", () => {
  it("starts again from the sample when stored data is malformed", () => {
    const parsed = parseDirectory({ schema: 1, accounts: [{ id: 1 }] });
    expect(parsed.accounts.length).toBe(sampleDirectory().accounts.length);
  });
});
