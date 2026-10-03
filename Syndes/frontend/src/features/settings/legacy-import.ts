import { accountScopedKey } from "@/lib/account-scope";
import { DRAFTS_KEY, parseDraftStore } from "@/features/authoring/draft-store";
import { PROGRESS_KEY, parseProgressStore } from "@/features/progress/progress-store";

type ImportResult =
  | { status: "denied" }
  | { status: "already-imported" }
  | { status: "imported"; progressCount: number; draftCount: number };

function parsed<T>(storage: Storage, key: string, parse: (raw: unknown) => T): T {
  try {
    return parse(JSON.parse(storage.getItem(key) ?? "null"));
  } catch {
    return parse(null);
  }
}

function notifyStorage(key: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new StorageEvent("storage", { key }));
}

/** Legacy device-wide data stays in its original bucket. A named, approved Account must choose import. */
export function importLegacyLearningData(storage: Storage, accountId: string | null, approved: boolean): ImportResult {
  if (!accountId || !approved) return { status: "denied" };
  const marker = accountScopedKey("syndes:legacy-progress-import:v1", accountId);
  if (storage.getItem(marker)) return { status: "already-imported" };
  const key = accountScopedKey(PROGRESS_KEY, accountId);
  const legacy = parsed(storage, PROGRESS_KEY, parseProgressStore);
  const current = parsed(storage, key, parseProgressStore);
  const added = Object.keys(legacy.modules).filter((id) => !current.modules[id]).length;
  // Existing Account work wins on collision; import never discards newer work.
  storage.setItem(key, JSON.stringify({ schema: 1, modules: { ...legacy.modules, ...current.modules } }));
  storage.setItem(marker, "done");
  notifyStorage(key);
  return { status: "imported", progressCount: added, draftCount: 0 };
}

/** Called only from the online-checked Teacher area. Drafts never enter a Learner's partition. */
export function importLegacyDrafts(storage: Storage, accountId: string | null, canTeach: boolean): ImportResult {
  if (!accountId || !canTeach) return { status: "denied" };
  const marker = accountScopedKey("syndes:legacy-drafts-import:v1", accountId);
  if (storage.getItem(marker)) return { status: "already-imported" };
  const key = accountScopedKey(DRAFTS_KEY, accountId);
  const legacy = parsed(storage, DRAFTS_KEY, parseDraftStore);
  const current = parsed(storage, key, parseDraftStore);
  const added = Object.keys(legacy.drafts).filter((id) => !current.drafts[id]).length;
  storage.setItem(key, JSON.stringify({ schema: 1, drafts: { ...legacy.drafts, ...current.drafts } }));
  storage.setItem(marker, "done");
  notifyStorage(key);
  return { status: "imported", progressCount: 0, draftCount: added };
}

/** Explicitly removes this Account's local work, including saved Module files; other Accounts and legacy data remain. */
export async function resetLocalAccountData(storage: Storage, accountId: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(accountId)) throw new Error("Invalid Account id.");
  const { isTauri } = await import("@tauri-apps/api/core");
  if (isTauri()) {
    const { exists, remove, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const path = `modules/${accountId}`;
    if (await exists(path, { baseDir: BaseDirectory.AppLocalData })) {
      await remove(path, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    }
  }
  const keys = [
    PROGRESS_KEY,
    DRAFTS_KEY,
    "syndes:modules:v1",
    "syndes:legacy-progress-import:v1",
    "syndes:legacy-drafts-import:v1",
  ];
  for (const base of keys) {
    const key = accountScopedKey(base, accountId);
    storage.removeItem(key);
    notifyStorage(key);
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("syndes:modules-changed"));
}
