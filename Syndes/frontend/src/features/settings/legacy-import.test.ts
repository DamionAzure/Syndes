import { beforeEach, expect, it, vi } from "vitest";
import { accountScopedKey } from "@/lib/account-scope";
import { DRAFTS_KEY, EMPTY_DRAFTS } from "@/features/authoring/draft-store";
import { PROGRESS_KEY, recordStep } from "@/features/progress/progress-store";
import { importLegacyLearningData, resetLocalAccountData } from "./legacy-import";

const { isTauri, invoke, exists, remove } = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
  invoke: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri, invoke }));
vi.mock("@tauri-apps/plugin-fs", () => ({ exists, remove, BaseDirectory: { AppLocalData: 1 } }));

beforeEach(() => {
  window.localStorage.clear();
  isTauri.mockReturnValue(false);
  invoke.mockReset();
  exists.mockReset();
  remove.mockReset();
});

it("imports legacy Progress only after an approved Account explicitly requests it, once", () => {
  const legacy = recordStep({ schema: 1, modules: {} }, { id: "mod_one", version: "1" }, { kind: "lesson", lesson: 1 }, "2026-10-02T10:00:00Z");
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(legacy));
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(EMPTY_DRAFTS));

  expect(importLegacyLearningData(window.localStorage, "alice", false)).toEqual({ status: "denied" });
  expect(window.localStorage.getItem(accountScopedKey(PROGRESS_KEY, "alice"))).toBeNull();
  expect(importLegacyLearningData(window.localStorage, "alice", true)).toEqual({ status: "imported", progressCount: 1, draftCount: 0 });
  expect(JSON.parse(window.localStorage.getItem(accountScopedKey(PROGRESS_KEY, "alice")) ?? "null").modules).toHaveProperty("mod_one");
  expect(importLegacyLearningData(window.localStorage, "alice", true)).toEqual({ status: "already-imported" });
  expect(window.localStorage.getItem(PROGRESS_KEY)).toBe(JSON.stringify(legacy));
});

it("a local-data reset removes only the selected Account's work", async () => {
  const alice = accountScopedKey(PROGRESS_KEY, "alice");
  const bob = accountScopedKey(PROGRESS_KEY, "bob");
  window.localStorage.setItem(alice, "saved Alice");
  window.localStorage.setItem(bob, "saved Bob");
  await resetLocalAccountData(window.localStorage, "alice");
  expect(window.localStorage.getItem(alice)).toBeNull();
  expect(window.localStorage.getItem(bob)).toBe("saved Bob");
});

it("clears the same Account's loaded desktop Modules after its files and storage are removed", async () => {
  isTauri.mockReturnValue(true);
  exists.mockResolvedValue(true);
  remove.mockResolvedValue(undefined);
  const key = accountScopedKey(PROGRESS_KEY, "alice");
  window.localStorage.setItem(key, "saved Alice");
  invoke.mockImplementation(() => {
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(remove).toHaveBeenCalledOnce();
    return Promise.resolve();
  });

  await resetLocalAccountData(window.localStorage, "alice");

  expect(invoke).toHaveBeenCalledWith("clear_loaded_modules");
});
