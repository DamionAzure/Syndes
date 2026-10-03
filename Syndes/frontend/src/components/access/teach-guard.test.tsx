import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/access/access";
import { TeachGuard } from "./teach-guard";

const replace = vi.fn();
const resolveAccess = vi.fn<(requirePrivileged: boolean) => Promise<AuthContext>>();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/access/access-bridge", () => ({
  resolveAccess: (requirePrivileged: boolean) => resolveAccess(requirePrivileged),
}));

function renderGuard() {
  return render(
    <TeachGuard>
      <h1>Class record</h1>
    </TeachGuard>,
  );
}

describe("TeachGuard", () => {
  beforeEach(() => {
    replace.mockReset();
    resolveAccess.mockReset();
  });

  it("shows nothing of the Teacher page while access is being checked", () => {
    resolveAccess.mockReturnValue(new Promise(() => {}));
    renderGuard();
    expect(screen.getByRole("status")).toHaveTextContent("Checking your access");
    expect(screen.queryByRole("heading", { name: "Class record" })).not.toBeInTheDocument();
  });

  it("sends a Student to Home without rendering the page", async () => {
    resolveAccess.mockResolvedValue({ role: "student", readOnly: false, source: "offlineVerified" });
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("heading", { name: "Class record" })).not.toBeInTheDocument();
  });

  it("sends the read-only floor to Home", async () => {
    resolveAccess.mockResolvedValue({ role: "student", readOnly: true, source: "studentReadOnly" });
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("asks the core with the privileged check and renders for a Teacher", async () => {
    resolveAccess.mockResolvedValue({ role: "teacher", readOnly: false, source: "offlineVerified" });
    renderGuard();
    expect(await screen.findByRole("heading", { name: "Class record" })).toBeInTheDocument();
    expect(resolveAccess).toHaveBeenCalledWith(true);
    expect(replace).not.toHaveBeenCalled();
  });
});
