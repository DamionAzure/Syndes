import type { ModuleProgress, ProgressStore, Step } from "./progress-types";

export const PROGRESS_KEY = "syndes:progress:v1";

export const EMPTY_PROGRESS: ProgressStore = { schema: 1, modules: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

function parseStep(raw: unknown): Step | null {
  if (!isRecord(raw)) return null;
  switch (raw["kind"]) {
    case "overview":
      return { kind: "overview" };
    case "result":
      return { kind: "result" };
    case "lesson":
      return isPositiveInteger(raw["lesson"])
        ? { kind: "lesson", lesson: raw["lesson"] }
        : null;
    case "quiz":
      return isPositiveInteger(raw["question"])
        ? { kind: "quiz", question: raw["question"] }
        : null;
    default:
      return null;
  }
}

function parseAnswers(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const answers: Record<string, string> = {};
  for (const [questionId, answer] of Object.entries(raw)) {
    if (typeof answer !== "string") return null;
    answers[questionId] = answer;
  }
  return answers;
}

function parseEntry(raw: unknown): ModuleProgress | null {
  if (!isRecord(raw)) return null;
  const { moduleId, contentVersion, finalLessonReached, quizSubmitted, updatedAt } = raw;
  const step = parseStep(raw["step"]);
  const answers = parseAnswers(raw["answers"]);
  if (
    typeof moduleId !== "string" ||
    typeof contentVersion !== "string" ||
    typeof finalLessonReached !== "boolean" ||
    typeof quizSubmitted !== "boolean" ||
    typeof updatedAt !== "string" ||
    Number.isNaN(Date.parse(updatedAt)) ||
    step === null ||
    answers === null
  ) {
    return null;
  }
  return { moduleId, contentVersion, step, answers, finalLessonReached, quizSubmitted, updatedAt };
}

/** Stored progress is untrusted: malformed entries are dropped, never thrown. */
export function parseProgressStore(raw: unknown): ProgressStore {
  if (!isRecord(raw) || raw["schema"] !== 1 || !isRecord(raw["modules"])) {
    return EMPTY_PROGRESS;
  }
  const modules: Record<string, ModuleProgress> = {};
  for (const [key, value] of Object.entries(raw["modules"])) {
    const entry = parseEntry(value);
    if (entry && entry.moduleId === key) modules[key] = entry;
  }
  return { schema: 1, modules };
}

/** The two Module facts progress depends on. */
export type ModuleRef = { id: string; version: string };

/**
 * Progress saved against a different content version no longer matches the
 * Module, so it is treated as absent and flagged `stale` for a notice.
 */
export function readModuleProgress(
  store: ProgressStore,
  module: ModuleRef,
): { progress: ModuleProgress | null; stale: boolean } {
  const saved = store.modules[module.id];
  if (!saved) return { progress: null, stale: false };
  if (saved.contentVersion !== module.version) return { progress: null, stale: true };
  return { progress: saved, stale: false };
}

function freshProgress(module: ModuleRef, now: string): ModuleProgress {
  return {
    moduleId: module.id,
    contentVersion: module.version,
    step: { kind: "overview" },
    answers: {},
    finalLessonReached: false,
    quizSubmitted: false,
    updatedAt: now,
  };
}

/** Applies a change to a Module's current-version progress, starting fresh if needed. */
function updateModule(
  store: ProgressStore,
  module: ModuleRef,
  now: string,
  change: (current: ModuleProgress) => Partial<ModuleProgress>,
): ProgressStore {
  const current = readModuleProgress(store, module).progress ?? freshProgress(module, now);
  return {
    schema: 1,
    modules: {
      ...store.modules,
      [module.id]: { ...current, ...change(current), updatedAt: now },
    },
  };
}

export function recordStep(
  store: ProgressStore,
  module: ModuleRef,
  step: Step,
  now: string,
): ProgressStore {
  return updateModule(store, module, now, () => ({ step }));
}

export function recordAnswer(
  store: ProgressStore,
  module: ModuleRef,
  questionId: string,
  answer: string,
  now: string,
): ProgressStore {
  return updateModule(store, module, now, (current) => ({
    answers: { ...current.answers, [questionId]: answer },
  }));
}

export function markFinalLessonReached(
  store: ProgressStore,
  module: ModuleRef,
  now: string,
): ProgressStore {
  return updateModule(store, module, now, () => ({ finalLessonReached: true }));
}

export function markQuizSubmitted(
  store: ProgressStore,
  module: ModuleRef,
  now: string,
): ProgressStore {
  return updateModule(store, module, now, () => ({
    quizSubmitted: true,
    step: { kind: "result" },
  }));
}

/** Completed: final Lesson reached and, when the Module has a Quiz, submitted. */
export function isCompleted(
  progress: ModuleProgress,
  module: { questionCount: number },
): boolean {
  const hasQuiz = module.questionCount > 0;
  return progress.finalLessonReached && (!hasQuiz || progress.quizSubmitted);
}

/** Retry: forget this Quiz attempt and start again at Question 1. */
export function retryQuiz(
  store: ProgressStore,
  module: ModuleRef,
  now: string,
): ProgressStore {
  return updateModule(store, module, now, () => ({
    answers: {},
    quizSubmitted: false,
    step: { kind: "quiz", question: 1 },
  }));
}

export function resetModuleProgress(
  store: ProgressStore,
  moduleId: string,
): ProgressStore {
  const modules = { ...store.modules };
  delete modules[moduleId];
  return { schema: 1, modules };
}

export function resetAllProgress(): ProgressStore {
  return { schema: 1, modules: {} };
}

/** The most recently used Module that is still on the device at its saved version. */
export function continueTarget(
  store: ProgressStore,
  modulesOnDevice: readonly ModuleRef[],
): ModuleProgress | null {
  let latest: ModuleProgress | null = null;
  for (const candidate of modulesOnDevice) {
    const { progress } = readModuleProgress(store, candidate);
    if (progress && (!latest || Date.parse(progress.updatedAt) > Date.parse(latest.updatedAt))) {
      latest = progress;
    }
  }
  return latest;
}
