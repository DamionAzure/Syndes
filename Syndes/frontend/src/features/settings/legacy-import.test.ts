import { beforeEach, expect, it } from "vitest";
import { accountScopedKey } from "@/lib/account-scope";
import { DRAFTS_KEY, EMPTY_DRAFTS } from "@/features/authoring/draft-store";
import { PROGRESS_KEY, recordStep } from "@/features/progress/progress-store";
import { importLegacyLearningData, resetLocalAccountData } from "./legacy-import";

beforeEach(() => window.localStorage.clear());

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
