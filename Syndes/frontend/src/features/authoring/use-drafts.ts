import { useSyncExternalStore } from "react";
import { getStoredValue, type StoredValue } from "@/lib/local-json-storage";
import { accountScopedKey } from "@/lib/account-scope";
import { getActiveAccountId, subscribeToActiveAccount } from "@/lib/active-account";
import { DRAFTS_KEY, EMPTY_DRAFTS, parseDraftStore, updateDraft } from "./draft-store";
import type { DraftStore, ModuleDraft } from "./draft-types";

/**
 * The Drafts store for the CURRENTLY active Account (ADR 0007: a Teacher's Drafts
 * belong to their Account and are hidden from every other Account). Stable per
 * Account via `getStoredValue`.
 */
function activeDraftsValue(): StoredValue<DraftStore> {
  const key = accountScopedKey(DRAFTS_KEY, getActiveAccountId());
  return getStoredValue(key, parseDraftStore, EMPTY_DRAFTS);
}

/** Every draft saved by the active Account on this device. Server snapshot is empty. */
export function useDraftStore(): DraftStore {
  const accountId = useSyncExternalStore(
    subscribeToActiveAccount,
    getActiveAccountId,
    () => null,
  );
  void accountId;
  const value = activeDraftsValue();
  return useSyncExternalStore(value.subscribe, value.get, value.getServerSnapshot);
}

export function updateDrafts(change: (store: DraftStore) => DraftStore): void {
  activeDraftsValue().update(change);
}

/** Applies one edit to one draft and stamps it as just saved. */
export function editDraft(id: string, change: (draft: ModuleDraft) => ModuleDraft): void {
  updateDrafts((store) => updateDraft(store, id, change, new Date().toISOString()));
}
