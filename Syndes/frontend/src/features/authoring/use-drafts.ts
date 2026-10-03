import { useSyncExternalStore } from "react";
import { createStoredValue } from "@/lib/local-json-storage";
import { DRAFTS_KEY, EMPTY_DRAFTS, parseDraftStore, updateDraft } from "./draft-store";
import type { DraftStore, ModuleDraft } from "./draft-types";

const draftsValue = createStoredValue(DRAFTS_KEY, parseDraftStore, EMPTY_DRAFTS);

/** Every draft saved on this device. The server snapshot is empty. */
export function useDraftStore(): DraftStore {
  return useSyncExternalStore(draftsValue.subscribe, draftsValue.get, draftsValue.getServerSnapshot);
}

export function updateDrafts(change: (store: DraftStore) => DraftStore): void {
  draftsValue.update(change);
}

/** Applies one edit to one draft and stamps it as just saved. */
export function editDraft(id: string, change: (draft: ModuleDraft) => ModuleDraft): void {
  updateDrafts((store) => updateDraft(store, id, change, new Date().toISOString()));
}
