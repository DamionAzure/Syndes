import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ModuleDraft } from "../draft-types";

const { seal } = vi.hoisted(() => ({ seal: vi.fn() }));
vi.mock("../draft-sealer", () => ({ useDraftSealer: () => ({ seal }) }));

const draft: ModuleDraft = {
  id: "12345678-0000-0000-0000-000000000000",
  start: "module", title: "Plants", subject: "Science", gradeLevel: "4",
  summary: "", outcomes: "", lessons: [{ id: "lesson-one", title: "Plants", minutes: 10, blocks: [] }],
  questions: [], flashcards: [], createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T00:00:00Z",
};

it("offers Seal and publish and reports success only after the operation completes", async () => {
  seal.mockResolvedValue({ status: "published" });
  const { SealPanel } = await import("./seal-panel");
  render(<SealPanel draft={draft} issues={[]} onShowIssue={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Seal and publish" }));
  await waitFor(() => expect(seal).toHaveBeenCalledWith(expect.objectContaining({ module: expect.objectContaining({ title: "Plants" }) })));
  expect(await screen.findByRole("status")).toHaveTextContent("Sealed and published");
});
