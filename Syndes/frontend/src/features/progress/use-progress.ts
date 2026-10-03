import { useEffect, useState, useSyncExternalStore } from "react";
import { getStoredValue, type StoredValue } from "@/lib/local-json-storage";
import { accountScopedKey } from "@/lib/account-scope";
import { getActiveAccountId, subscribeToActiveAccount } from "@/lib/active-account";
import {
  EMPTY_PROGRESS,
  PROGRESS_KEY,
  parseProgressStore,
  readModuleProgress,
  resetModuleProgress,
  type ModuleRef,
} from "./progress-store";
import type { ModuleProgress, ProgressStore } from "./progress-types";

/**
 * The Progress store for the CURRENTLY active Account (ADR 0007). Resolved fresh
 * on each access so a sign-in/out swaps partitions; `getStoredValue` returns a
 * stable instance per key, so repeated calls for the same Account are cheap and
 * keep `useSyncExternalStore` subscriptions stable.
 */
function activeProgressValue(): StoredValue<ProgressStore> {
  const key = accountScopedKey(PROGRESS_KEY, getActiveAccountId());
  return getStoredValue(key, parseProgressStore, EMPTY_PROGRESS);
}

/**
 * All saved Progress for the active Account on this device. The server snapshot
 * is empty, so static HTML never claims that progress exists. Re-renders on both
 * storage changes and Account switches.
 */
export function useProgressStore(): ProgressStore {
  // Re-subscribe when the active Account changes by re-reading the scoped value.
  const accountId = useSyncExternalStore(
    subscribeToActiveAccount,
    getActiveAccountId,
    () => null,
  );
  // `accountId` participates so the memoized value is recomputed on a switch.
  void accountId;
  const value = activeProgressValue();
  return useSyncExternalStore(value.subscribe, value.get, value.getServerSnapshot);
}

export function updateProgress(change: (store: ProgressStore) => ProgressStore): void {
  activeProgressValue().update(change);
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

  const version = module?.version;

  useEffect(() => {
    if (!read.stale || !moduleId || !version) return;
    // Recheck inside the update so a fresh place saved by the view survives.
    updateProgress((current) =>
      readModuleProgress(current, { id: moduleId, version }).stale
        ? resetModuleProgress(current, moduleId)
        : current,
    );
  }, [read.stale, moduleId, version]);

  return { progress: read.progress, versionReset };
}
