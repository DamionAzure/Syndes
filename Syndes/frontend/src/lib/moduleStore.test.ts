import { beforeEach, expect, it, vi } from "vitest";
import type { Module } from "./types";

const { resolveAccess, upsert } = vi.hoisted(() => ({ resolveAccess: vi.fn(), upsert: vi.fn() }));
vi.mock("./access/access-bridge", () => ({ resolveAccess }));
vi.mock("./supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "teacher-one" } } }) },
    from: () => ({ upsert }),
  },
}));

const sealed: Module = {
  schema_version: "1.0",
  module: { id: "mod_one", type: "lesson", title: "Plants" },
  lesson: { blocks: [{ kind: "paragraph", text: "Plants grow." }] },
};

beforeEach(() => { resolveAccess.mockReset(); upsert.mockReset(); });

it("requires a fresh online Teacher check before publishing a sealed Module", async () => {
  resolveAccess.mockResolvedValue({ role: "teacher", approved: true, active: true, accountId: "teacher-one", readOnly: false, source: "offlineVerified" });
  const { publishModule } = await import("./moduleStore");
  await expect(publishModule(sealed)).rejects.toThrow(/Teacher access/);
  expect(resolveAccess).toHaveBeenCalledWith(true);
  expect(upsert).not.toHaveBeenCalled();
});

it("publishes only when the fresh Teacher Account matches Supabase Auth", async () => {
  resolveAccess.mockResolvedValue({ role: "teacher", approved: true, active: true, accountId: "teacher-one", readOnly: false, source: "onlineGate" });
  upsert.mockResolvedValue({ error: null });
  const { publishModule } = await import("./moduleStore");
  await publishModule(sealed);
  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({ id: "mod_one", owner: "teacher-one", published: true, data: sealed }),
    { onConflict: "id" },
  );
});

it("re-publishes the same Draft ID through the owner-checked update path", async () => {
  resolveAccess.mockResolvedValue({ role: "teacher", approved: false, active: true, accountId: "teacher-one", readOnly: false, source: "onlineGate" });
  upsert.mockResolvedValue({ error: null });
  const { publishModule } = await import("./moduleStore");
  await publishModule(sealed);
  await publishModule({ ...sealed, module: { ...sealed.module, title: "Plants revised" } });
  expect(upsert).toHaveBeenCalledTimes(2);
  expect(upsert.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ id: "mod_one", owner: "teacher-one", data: expect.objectContaining({ module: expect.objectContaining({ title: "Plants revised" }) }) }));
});
