import { FIXTURE_LEARNERS } from "@/features/class-records/fixture-class-records";
import type { Account, ActivityEntry, Directory, Enrollment, SchoolClass, Section, TeacherAssignment } from "./directory-types";

/**
 * SAMPLE DATA ONLY (ADR-0008 proposal). A fictional elementary school so the
 * Administrator screens can be designed and reviewed before the Supabase
 * directory is connected. Grade 6 reuses the Teacher area's sample Learners
 * so both roles see the same school. Never add real people here.
 */

/** The signed-in Administrator in the sample. */
export const SAMPLE_ADMIN_ID = "admin-01";

const SCHOOL_YEAR_START = "2026-06-15T08:00:00+08:00";

const SECTIONS: Section[] = [
  { id: "g4-mabini", gradeLevel: "Grade 4", name: "Mabini" },
  { id: "g4-rizal", gradeLevel: "Grade 4", name: "Rizal" },
  { id: "g5-bonifacio", gradeLevel: "Grade 5", name: "Bonifacio" },
  { id: "g5-luna", gradeLevel: "Grade 5", name: "Luna" },
  { id: "g6-narra", gradeLevel: "Grade 6", name: "Narra" },
  { id: "g6-sampaguita", gradeLevel: "Grade 6", name: "Sampaguita" },
];

const LEARNING_AREAS = ["English", "Filipino", "Mathematics", "Science"] as const;

const CLASSES: SchoolClass[] = SECTIONS.flatMap((section) =>
  LEARNING_AREAS.map((learningArea) => ({
    id: `${section.id}-${learningArea.toLowerCase()}`,
    sectionId: section.id,
    learningArea,
  })),
);

function staff(
  id: string,
  givenName: string,
  familyName: string,
  role: Account["role"],
  joinedAt = "2026-05-20T09:00:00+08:00",
): Account {
  return {
    id,
    givenName,
    familyName,
    email: `${givenName[0]?.toLowerCase()}.${familyName.toLowerCase().replace(/\s+/g, "")}@school.example`,
    role,
    status: "active",
    lrn: null,
    joinedAt,
  };
}

const STAFF: Account[] = [
  staff(SAMPLE_ADMIN_ID, "Elena", "Marquez", "admin", "2026-05-02T09:00:00+08:00"),
  staff("teacher-01", "Ramon", "Aquino", "teacher"),
  staff("teacher-02", "Cristina", "Bautista", "teacher"),
  staff("teacher-03", "Jose", "Castillo", "teacher"),
  staff("teacher-04", "Liza", "De Guzman", "teacher"),
  staff("teacher-05", "Mark", "Estrada", "teacher"),
  staff("teacher-06", "Ana", "Fernandez", "teacher"),
  staff("teacher-07", "Paolo", "Gonzales", "teacher"),
  { ...staff("teacher-08", "Rachel", "Ilagan", "teacher"), status: "removed" },
];

/** Who teaches what. Two classes are left without a teacher on purpose. */
const TEACHING: Record<string, string> = {
  "g6-sampaguita-science": "teacher-01",
  "g6-narra-science": "teacher-01",
  "g6-sampaguita-english": "teacher-01",
  "g6-narra-english": "teacher-02",
  "g6-sampaguita-mathematics": "teacher-03",
  "g6-narra-mathematics": "teacher-03",
  "g6-sampaguita-filipino": "teacher-04",
  "g5-bonifacio-english": "teacher-02",
  "g5-luna-english": "teacher-02",
  "g5-bonifacio-mathematics": "teacher-05",
  "g5-luna-mathematics": "teacher-05",
  "g5-bonifacio-science": "teacher-06",
  "g5-luna-science": "teacher-06",
  "g5-bonifacio-filipino": "teacher-04",
  "g5-luna-filipino": "teacher-04",
  "g4-mabini-english": "teacher-07",
  "g4-rizal-english": "teacher-07",
  "g4-mabini-mathematics": "teacher-05",
  "g4-mabini-science": "teacher-06",
  "g4-rizal-science": "teacher-06",
  "g4-mabini-filipino": "teacher-07",
  "g4-rizal-filipino": "teacher-07",
};

const ASSIGNMENTS: TeacherAssignment[] = Object.entries(TEACHING).map(([classId, teacherId]) => ({
  id: `assign-${classId}`,
  classId,
  teacherId,
  startedAt: SCHOOL_YEAR_START,
  endedAt: null,
}));

const GIVEN = ["Aira", "Bryan", "Carla", "Daniel", "Erika", "Francis", "Gwen", "Hector", "Iris", "Jerome", "Kim", "Lorenzo", "Mika", "Noel", "Olivia", "Patrick"];
const FAMILY = ["Abad", "Bernardo", "Cortez", "Domingo", "Espino", "Flores", "Galang", "Hernandez", "Ignacio", "Jimenez", "Lacson", "Macaraeg", "Nepomuceno", "Ortiz", "Perez", "Quiambao"];

function learner(id: string, number: number, givenName: string, familyName: string, joinedAt = SCHOOL_YEAR_START): Account {
  return {
    id,
    givenName,
    familyName,
    email: `${givenName.toLowerCase()}.${familyName.toLowerCase().replace(/\s+/g, "")}${number}@learners.school.example`,
    role: "student",
    status: "active",
    lrn: `2000000000${String(number).padStart(2, "0")}`,
    joinedAt,
  };
}

const GRADE_6: Account[] = FIXTURE_LEARNERS.map((sample, index) => ({
  ...learner(sample.id, index + 1, sample.givenName, sample.familyName),
  lrn: sample.lrn,
}));

const LOWER_SECTIONS = ["g4-mabini", "g4-rizal", "g5-bonifacio", "g5-luna"];

const LOWER_GRADES: { account: Account; sectionId: string }[] = LOWER_SECTIONS.flatMap((sectionId, sectionIndex) =>
  Array.from({ length: 8 }, (_, index) => {
    const number = 17 + sectionIndex * 8 + index;
    const givenName = GIVEN[(sectionIndex * 5 + index * 3) % GIVEN.length] ?? "Alex";
    const familyName = FAMILY[(sectionIndex * 7 + index) % FAMILY.length] ?? "Reyes";
    return { account: learner(`learner-${number}`, number, givenName, familyName), sectionId };
  }),
);

/** Three Learners who left this year, so the drop and transfer figures have history. */
const LEFT: { account: Account; sectionId: string; status: Enrollment["status"]; endedAt: string }[] = [
  { account: learner("learner-49", 49, "Jun", "Villareal"), sectionId: "g5-luna", status: "dropped", endedAt: "2026-08-28T10:00:00+08:00" },
  { account: learner("learner-50", 50, "Marites", "Soriano"), sectionId: "g4-rizal", status: "transferred", endedAt: "2026-09-12T10:00:00+08:00" },
  { account: learner("learner-51", 51, "Rico", "Tolentino"), sectionId: "g6-narra", status: "dropped", endedAt: "2026-09-25T10:00:00+08:00" },
];

/** New sign-ins nobody has placed yet: signing in alone grants nothing (ADR-0004). */
const WAITING: Account[] = [
  staff("account-52", "Jessa", "Dizon", "student", "2026-10-01T14:12:00+08:00"),
  staff("account-53", "Victor", "Salazar", "student", "2026-10-02T09:40:00+08:00"),
  learner("learner-54", 54, "Bianca", "Roxas", "2026-10-03T16:05:00+08:00"),
];

const ENROLLMENTS: Enrollment[] = [
  ...GRADE_6.map((account, index) => ({
    id: `enrol-${account.id}`,
    learnerId: account.id,
    sectionId: index % 2 === 0 ? "g6-sampaguita" : "g6-narra",
    status: "enrolled" as const,
    startedAt: SCHOOL_YEAR_START,
    endedAt: null,
  })),
  ...LOWER_GRADES.map(({ account, sectionId }) => ({
    id: `enrol-${account.id}`,
    learnerId: account.id,
    sectionId,
    status: "enrolled" as const,
    startedAt: SCHOOL_YEAR_START,
    endedAt: null,
  })),
  ...LEFT.map(({ account, sectionId, status, endedAt }) => ({
    id: `enrol-${account.id}`,
    learnerId: account.id,
    sectionId,
    status,
    startedAt: SCHOOL_YEAR_START,
    endedAt,
  })),
];

const ACTIVITY: ActivityEntry[] = [
  { id: "act-6", at: "2026-10-03T16:30:00+08:00", actorId: SAMPLE_ADMIN_ID, action: "teacher-unassigned", subjectId: "g6-narra-filipino", summary: "Unassigned Rachel Ilagan from Filipino, Grade 6 Narra." },
  { id: "act-5", at: "2026-10-03T16:28:00+08:00", actorId: SAMPLE_ADMIN_ID, action: "access-removed", subjectId: "teacher-08", summary: "Removed all access for Rachel Ilagan." },
  { id: "act-4", at: "2026-09-25T10:00:00+08:00", actorId: SAMPLE_ADMIN_ID, action: "learner-dropped", subjectId: "learner-51", summary: "Recorded Rico Tolentino as dropped from Grade 6 Narra." },
  { id: "act-3", at: "2026-09-12T10:00:00+08:00", actorId: SAMPLE_ADMIN_ID, action: "learner-transferred", subjectId: "learner-50", summary: "Recorded Marites Soriano as transferred out of Grade 4 Rizal." },
  { id: "act-2", at: "2026-08-28T10:00:00+08:00", actorId: SAMPLE_ADMIN_ID, action: "learner-dropped", subjectId: "learner-49", summary: "Recorded Jun Villareal as dropped from Grade 5 Luna." },
  { id: "act-1", at: "2026-06-10T08:00:00+08:00", actorId: SAMPLE_ADMIN_ID, action: "teacher-access-granted", subjectId: "teacher-01", summary: "Gave Ramon Aquino Teacher access." },
];

export function sampleDirectory(): Directory {
  return {
    schema: 1,
    accounts: [
      ...STAFF,
      ...GRADE_6,
      ...LOWER_GRADES.map(({ account }) => account),
      ...LEFT.map(({ account }) => account),
      ...WAITING,
    ],
    sections: SECTIONS,
    classes: CLASSES,
    assignments: ASSIGNMENTS,
    enrollments: ENROLLMENTS,
    activity: ACTIVITY,
  };
}
