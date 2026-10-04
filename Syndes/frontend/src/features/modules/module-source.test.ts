import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/access/access-provider", () => ({ useAccess: () => ({ accountId: null, context: { approved: false } }) }));
import { createModuleSource } from "./module-source";
import type { Module as SealedModule } from "@/lib/types";

const sealed: SealedModule = {
  schema_version: "1.0",
  module: { id: "mod_science", type: "lesson", title: "Plant cells", subject: "Science" },
  lesson: { blocks: [{ kind: "heading", text: "Cells" }, { kind: "paragraph", text: "Plants have cells." }] },
};

const remote = {
  async listModules() {
    return [{ id: "mod_science", title: "Plant cells", subject: "Science", grade_level: "6", type: "lesson" as const, question_count: 0, published_at: "2026-10-01T00:00:00Z" }];
  },
  async getModule() { return sealed; },
};
const native = { async load(module: SealedModule) { return module; } };

beforeEach(() => window.localStorage.clear());

describe("Account learning journey", () => {
  it("does not list published Modules or open a local file for a Pending Account", async () => {
    const online = createModuleSource({ accountId: "pending", approved: false, online: true, storage: window.localStorage, remote, native });
    expect(await online.listModules()).toEqual([]);
    expect(await online.openModuleFile(new File([JSON.stringify(sealed)], "module.json"))).toEqual({
      status: "invalid",
      message: "Your Account needs approval before opening a Module.",
    });
    expect(window.localStorage.length).toBe(0);
  });

  it("keeps a downloaded Module for its approved Account when offline, hidden from other Accounts", async () => {
    const alice = createModuleSource({ accountId: "alice", approved: true, online: true, storage: window.localStorage, remote, native });
    expect(await alice.listModules()).toEqual([expect.objectContaining({ title: "Plant cells", readyOffline: false })]);
    await alice.downloadModule("mod_science");
    expect(await alice.getModule("mod_science")).toEqual(expect.objectContaining({ title: "Plant cells" }));

    const aliceOffline = createModuleSource({ accountId: "alice", approved: true, online: false, storage: window.localStorage, remote, native });
    expect(await aliceOffline.listModules()).toEqual([expect.objectContaining({ title: "Plant cells", readyOffline: true })]);
    const bob = createModuleSource({ accountId: "bob", approved: true, online: false, storage: window.localStorage, remote, native });
    expect(await bob.listModules()).toEqual([]);
    expect(await bob.getModule("mod_science")).toBeNull();

    const revoked = createModuleSource({ accountId: "alice", approved: false, online: false, storage: window.localStorage, remote, native });
    expect(await revoked.listModules()).toEqual([]);
    expect(await revoked.getModule("mod_science")).toBeNull();
    expect(await aliceOffline.getModule("mod_science")).toEqual(expect.objectContaining({ title: "Plant cells" }));
  });
});
