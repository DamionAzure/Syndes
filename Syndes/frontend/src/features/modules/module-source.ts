import { use } from "react";
import { fixtureModuleSource } from "./fixture-module-source";
import type { Module, ModuleSummary } from "./module-types";

export type OpenModuleFileResult =
  | { status: "opened"; moduleId: string }
  | { status: "cancelled" }
  | { status: "unsupported" }
  | { status: "invalid"; message: string };

export interface ModuleSource {
  listModules(): Promise<ModuleSummary[]>;
  /** Resolves to null when the Module is not stored on this device. */
  getModule(id: string): Promise<Module | null>;
  openModuleFile(): Promise<OpenModuleFileResult>;
}

/** The one place the active source is chosen; the Tauri bridge replaces it here. */
const activeSource: ModuleSource = fixtureModuleSource;

export function useModuleSource(): ModuleSource {
  return activeSource;
}

// `use()` needs a stable promise per request, so reads are cached per key.
const reads = new Map<string, Promise<unknown>>();

function cachedRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  let pending = reads.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load();
    reads.set(key, pending);
  }
  return pending;
}

/** Suspends until the Library is listed. Use inside LocalDataBoundary. */
export function useModules(): ModuleSummary[] {
  return use(cachedRead("modules", () => activeSource.listModules()));
}

/** Suspends until the Module is read; null when it is not on this device. */
export function useModule(id: string | null): Module | null {
  if (!id) return null;
  return use(cachedRead(`module:${id}`, () => activeSource.getModule(id)));
}
