import { beforeEach, expect, it, vi } from "vitest";
import type { Module } from "@/lib/types";
import type { DraftModuleFile } from "./module-file";

const { invoke, isTauri, publishModule } = vi.hoisted(() => ({
  invoke: vi.fn(), isTauri: vi.fn(), publishModule: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke, isTauri }));
vi.mock("@/lib/moduleStore", () => ({ publishModule }));

const draft: DraftModuleFile = {
  schema_version: "1.0",
  module: { id: "mod_one", type: "lesson", title: "Plants" },
  lesson: { blocks: [{ kind: "paragraph", text: "Plants grow." }] },
};
const sealed: Module = {
  schema_version: "1.0",
  module: { id: "mod_one", type: "lesson", title: "Plants" },
  lesson: { blocks: [{ kind: "paragraph", text: "Plants grow." }] },
};

beforeEach(() => {
  invoke.mockReset();
  isTauri.mockReset();
  publishModule.mockReset();
  isTauri.mockReturnValue(true);
});

it("seals through the privileged native command and publishes only the sealed result", async () => {
  invoke.mockResolvedValue(sealed);
  publishModule.mockResolvedValue(undefined);
  const { useDraftSealer } = await import("./draft-sealer");
  await expect(useDraftSealer().seal(draft)).resolves.toEqual({ status: "published" });
  expect(invoke).toHaveBeenCalledWith("seal_module", { draft });
  expect(publishModule).toHaveBeenCalledWith(sealed);
});

it("keeps the Draft local and does not publish when the native online role check fails", async () => {
  invoke.mockRejectedValue(new Error("Teacher access requires an online check"));
  const { useDraftSealer } = await import("./draft-sealer");
  await expect(useDraftSealer().seal(draft)).resolves.toEqual({ status: "invalid", message: expect.stringMatching(/online check/) });
  expect(publishModule).not.toHaveBeenCalled();
});

it("reports a publish failure without claiming the Module was published", async () => {
  invoke.mockResolvedValue(sealed);
  publishModule.mockRejectedValue(new Error("Teacher access must be verified online"));
  const { useDraftSealer } = await import("./draft-sealer");
  await expect(useDraftSealer().seal(draft)).resolves.toEqual({ status: "invalid", message: expect.stringMatching(/verified online/) });
});

it("reports desktop sealing as unavailable in the browser", async () => {
  isTauri.mockReturnValue(false);
  const { useDraftSealer } = await import("./draft-sealer");
  await expect(useDraftSealer().seal(draft)).resolves.toEqual({ status: "unsupported" });
  expect(invoke).not.toHaveBeenCalled();
});
