import { useEffect, useState, useSyncExternalStore } from "react";
import { createStoredValue } from "@/lib/local-json-storage";
import {
  EMPTY_PROGRESS,
  PROGRESS_KEY,
  parseProgressStore,
  readModuleProgress,
  resetModuleProgress,
  type ModuleRef,
} from "./progress-store";
import type { ModuleProgress, ProgressStore } from "./progress-types";

const progressValue = createStoredValue(
  PROGRESS_KEY,
  parseProgressStore,
  EMPTY_PROGRESS,
);

/**
 * All saved Progress on this device. The server snapshot is empty, so static
 * HTML never claims that progress exists.
 */
export function useProgressStore(): ProgressStore {
  return useSyncExternalStore(
    progressValue.subscribe,
    progressValue.get,
    progressValue.getServerSnapshot,
  );
}

export function updateProgress(change: (store: ProgressStore) => ProgressStore): void {
  progressValue.update(change);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * One Module's current-version Progress. Progress saved against an older
 * version is discarded, and `versionReset` stays true for this view so it can
 * explain why the saved place is gone.
 */
export function useModuleProgress(module: ModuleRef | null): {
  progress: ModuleProgress | null;
  versionReset: boolean;
} {
  const store = useProgressStore();
  const read = module ? readModuleProgress(store, module) : { progress: null, stale: false };
  const [versionReset] = useState(read.stale);
  const moduleId = module?.id;

  useEffect(() => {
    if (read.stale && moduleId) {
      updateProgress((current) => resetModuleProgress(current, moduleId));
    }
  }, [read.stale, moduleId]);

  return { progress: read.progress, versionReset };
}
