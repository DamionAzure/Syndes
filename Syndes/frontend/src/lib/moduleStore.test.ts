import { beforeEach, expect, it, vi } from "vitest";
import type { Module } from "./types";

const { resolveAccess, insert } = vi.hoisted(() => ({ resolveAccess: vi.fn(), insert: vi.fn() }));
vi.mock("./access/access-bridge", () => ({ resolveAccess }));
vi.mock("./supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "teacher-one" } } }) },
    from: () => ({ insert }),
  },
}));

const sealed: Module = {
  schema_version: "1.0",
  module: { id: "mod_one", type: "lesson", title: "Plants" },
  lesson: { blocks: [{ kind: "paragraph", text: "Plants grow." }] },
};

beforeEach(() => { resolveAccess.mockReset(); insert.mockReset(); });

it("requires a fresh online Teacher check before publishing a sealed Module", async () => {
  resolveAccess.mockResolvedValue({ role: "teacher", approved: true, active: true, accountId: "teacher-one", readOnly: false, source: "offlineVerified" });
  const { publishModule } = await import("./moduleStore");
  await expect(publishModule(sealed)).rejects.toThrow(/Teacher access/);
  expect(resolveAccess).toHaveBeenCalledWith(true);
  expect(insert).not.toHaveBeenCalled();
});

it("publishes only when the fresh Teacher Account matches Supabase Auth", async () => {
  resolveAccess.mockResolvedValue({ role: "teacher", approved: true, active: true, accountId: "teacher-one", readOnly: false, source: "onlineGate" });
  insert.mockResolvedValue({ error: null });
  const { publishModule } = await import("./moduleStore");
  await publishModule(sealed);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ owner: "teacher-one", published: true }));
});
