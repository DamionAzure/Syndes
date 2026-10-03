/**
 * The school as an Administrator manages it: Accounts and their access,
 * Sections and Classes, who teaches each Class and who is enrolled in each
 * Section. Every change is recorded in the activity log.
 */

/** Matches the Supabase `app_role` enum and the Rust `Role`. */
export type AccountRole = "student" | "teacher" | "admin";

export type AccountStatus = "active" | "removed";

export type Account = {
  id: string;
  givenName: string;
  familyName: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  /** Learner Reference Number, for Learners only. */
  lrn: string | null;
  /** First sign-in. */
  joinedAt: string;
};

export type Section = { id: string; gradeLevel: string; name: string };

export type SchoolClass = { id: string; sectionId: string; learningArea: string };

/** One Teacher teaching one Class for a period of time. */
export type TeacherAssignment = {
  id: string;
  classId: string;
  teacherId: string;
  startedAt: string;
  /** null while current. */
  endedAt: string | null;
};

/**
 * enrolled: current. moved: left for another Section in this school.
 * dropped: stopped attending. transferred: left for another school.
 */
export type EnrollmentStatus = "enrolled" | "moved" | "dropped" | "transferred";

export type Enrollment = {
  id: string;
  learnerId: string;
  sectionId: string;
  status: EnrollmentStatus;
  startedAt: string;
  endedAt: string | null;
};

export type ActivityAction =
  | "teacher-access-granted"
  | "teacher-access-removed"
  | "teacher-assigned"
  | "teacher-unassigned"
  | "learner-enrolled"
  | "learner-moved"
  | "learner-dropped"
  | "learner-transferred"
  | "access-removed"
  | "access-restored"
  | "section-created"
  | "class-added";

export type ActivityEntry = {
  id: string;
  at: string;
  actorId: string;
  action: ActivityAction;
  /** The Account, Section or Class the change was about. */
  subjectId: string;
  summary: string;
};

export type Directory = {
  schema: 1;
  accounts: Account[];
  sections: Section[];
  classes: SchoolClass[];
  assignments: TeacherAssignment[];
  enrollments: Enrollment[];
  /** Newest first. */
  activity: ActivityEntry[];
};

/**
 * What an Account can do right now, derived from its role, status and
 * enrollment. "waiting" has never been placed; "unenrolled" left a Section.
 */
export type AccessState = "learner" | "teacher" | "admin" | "waiting" | "unenrolled" | "removed";
