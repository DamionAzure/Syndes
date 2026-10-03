import type {
  GradeRecord,
  Learner,
  ReportedModule,
  SchoolClass,
  Section,
} from "./class-record-types";

/**
 * SAMPLE DATA ONLY (ADR-0005). Fictional Learners so the Teacher screens can
 * be designed and reviewed before records are reported from Learner devices.
 * Never add real Learner information here.
 */

export const FIXTURE_SECTIONS: Section[] = [
  { id: "g6-sampaguita", gradeLevel: "Grade 6", name: "Sampaguita" },
  { id: "g6-narra", gradeLevel: "Grade 6", name: "Narra" },
];

export const FIXTURE_CLASSES: SchoolClass[] = [
  { id: "sci-sampaguita", sectionId: "g6-sampaguita", learningArea: "Science", weightGroup: "science-math" },
  { id: "eng-sampaguita", sectionId: "g6-sampaguita", learningArea: "English", weightGroup: "languages" },
  { id: "sci-narra", sectionId: "g6-narra", learningArea: "Science", weightGroup: "science-math" },
];

const NAMES: [given: string, family: string, guardian: string, relationship: string][] = [
  ["Andrea", "Bautista", "Liza Bautista", "Mother"],
  ["Paolo", "Cruz", "Ramon Cruz", "Father"],
  ["Bea", "Dela Rosa", "Carmen Dela Rosa", "Grandmother"],
  ["Miguel", "Garcia", "Rosa Garcia", "Mother"],
  ["Jasmine", "Lim", "Henry Lim", "Father"],
  ["Carlo", "Mendoza", "Teresa Mendoza", "Aunt"],
  ["Kyla", "Navarro", "Edwin Navarro", "Father"],
  ["Rafael", "Ocampo", "Gina Ocampo", "Mother"],
  ["Sofia", "Pascual", "Lorna Pascual", "Mother"],
  ["Gabriel", "Quinto", "Dante Quinto", "Father"],
  ["Hannah", "Ramos", "Nida Ramos", "Mother"],
  ["Joshua", "Santos", "Arturo Santos", "Grandfather"],
  ["Lea", "Torres", "Marites Torres", "Mother"],
  ["Nathan", "Uy", "Vincent Uy", "Father"],
  ["Rica", "Villanueva", "Joy Villanueva", "Mother"],
  ["Enzo", "Yap", "Grace Yap", "Mother"],
];

export const FIXTURE_LEARNERS: Learner[] = NAMES.map(([givenName, familyName, guardian, relationship], index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `learner-${number}`,
    lrn: `1000000000${number}`,
    givenName,
    familyName,
    sectionId: index % 2 === 0 ? "g6-sampaguita" : "g6-narra",
    guardian: { name: guardian, relationship, contact: `0900 000 00${number}` },
  };
});

/** Stable pseudo-random 0–1 from a string, so the sample never shifts between renders. */
function seeded(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

/** Each sample Learner has a steady level, so their records agree with each other. */
function level(learnerId: string): number {
  return 0.45 + seeded(`level:${learnerId}`) * 0.5;
}

function scoreOutOf(highest: number, learnerId: string, key: string): number {
  const value = level(learnerId) + (seeded(`${learnerId}:${key}`) - 0.5) * 0.25;
  return Math.max(0, Math.min(highest, Math.round(value * highest)));
}

const SAMPLE_MODULES = [
  { moduleId: "problem-solving", moduleTitle: "Problem solving", lessonCount: 6, questionCount: 5 },
  { moduleId: "photosynthesis", moduleTitle: "How plants make food", lessonCount: 3, questionCount: 3 },
  { moduleId: "reading-maps", moduleTitle: "Reading maps", lessonCount: 2, questionCount: 0 },
] as const;

export const FIXTURE_MODULE_IDS: readonly string[] = SAMPLE_MODULES.map((module) => module.moduleId);

export const FIXTURE_REPORTED_MODULES: ReportedModule[] = FIXTURE_LEARNERS.flatMap((learner) =>
  SAMPLE_MODULES.map((module, moduleIndex) => {
    const reach = seeded(`reach:${learner.id}:${module.moduleId}`);
    const lessonsReached =
      reach < 0.12 ? 0 : reach < 0.4 ? Math.max(1, Math.round(reach * module.lessonCount)) : module.lessonCount;
    const submitted = lessonsReached === module.lessonCount && module.questionCount > 0;
    const day = String(20 + moduleIndex + Math.floor(seeded(`day:${learner.id}`) * 6)).padStart(2, "0");
    return {
      learnerId: learner.id,
      ...module,
      lessonsReached,
      result: submitted
        ? {
            correct: scoreOutOf(module.questionCount, learner.id, module.moduleId),
            total: module.questionCount,
            submittedAt: `2026-09-${day}T09:15:00+08:00`,
          }
        : null,
      reportedAt: `2026-09-${day}T09:20:00+08:00`,
    };
  }),
);

/** Highest possible raw totals per quarter, as a Teacher's class record would list them. */
const HIGHEST = { writtenWork: 80, performanceTasks: 120, quarterlyAssessment: 50 } as const;

export const FIXTURE_GRADE_RECORDS: GradeRecord[] = FIXTURE_CLASSES.flatMap((schoolClass) =>
  FIXTURE_LEARNERS.filter((learner) => learner.sectionId === schoolClass.sectionId).flatMap((learner) =>
    ([1, 2] as const).map((quarter) => {
      const key = `${schoolClass.id}:q${quarter}`;
      // Quarter 2 is under way: written work and tasks so far, no quarterly assessment yet.
      const partial = quarter === 2 ? 0.5 : 1;
      return {
        learnerId: learner.id,
        classId: schoolClass.id,
        quarter,
        writtenWork: {
          score: scoreOutOf(HIGHEST.writtenWork * partial, learner.id, `${key}:ww`),
          highest: HIGHEST.writtenWork * partial,
        },
        performanceTasks: {
          score: scoreOutOf(HIGHEST.performanceTasks * partial, learner.id, `${key}:pt`),
          highest: HIGHEST.performanceTasks * partial,
        },
        quarterlyAssessment:
          quarter === 1
            ? {
                score: scoreOutOf(HIGHEST.quarterlyAssessment, learner.id, `${key}:qa`),
                highest: HIGHEST.quarterlyAssessment,
              }
            : null,
      };
    }),
  ),
);
