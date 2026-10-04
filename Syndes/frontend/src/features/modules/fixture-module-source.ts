import { FIXTURE_MODULES, FIXTURE_REMOTE_SUMMARIES } from "./fixture-modules";
import type { ModuleSource } from "./module-source";
import type { Module, ModuleSummary } from "./module-types";

function toSummary(module: Module): ModuleSummary {
  return {
    id: module.id,
    version: module.version,
    subject: module.subject,
    title: module.title,
    summary: module.summary,
    lessonCount: module.lessons.length,
    questionCount: module.quiz?.questions.length ?? 0,
    hasFlashcards: (module.flashcards?.length ?? 0) > 0,
    readyOffline: module.readyOffline,
  };
}

/**
 * Demo source backed by made-up content. Opening module files needs the real
 * importer, so it reports "unsupported" rather than pretending.
 */
export const fixtureModuleSource: ModuleSource = {
  async listModules() {
    return [...FIXTURE_MODULES.map(toSummary), ...FIXTURE_REMOTE_SUMMARIES];
  },
  async getModule(id) {
    return FIXTURE_MODULES.find((module) => module.id === id) ?? null;
  },
  async downloadModule() {
    throw new Error("Fixture Modules cannot be saved.");
  },
  async openModuleFile() {
    return { status: "unsupported" };
  },
};
