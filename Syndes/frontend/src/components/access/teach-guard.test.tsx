import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/access/access";
import { TeachGuard } from "./teach-guard";

const replace = vi.fn();
const router = { replace };
const resolveAccess = vi.fn<(requirePrivileged: boolean) => Promise<AuthContext>>();
let pathname = "/teach";

vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));
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
    pathname = "/teach";
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
    resolveAccess.mockResolvedValue({ accountId: "student-1", active: true, approved: true, role: "student", readOnly: false, source: "offlineVerified" });
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("heading", { name: "Class record" })).not.toBeInTheDocument();
  });

  it("sends the read-only floor to Home", async () => {
    resolveAccess.mockResolvedValue({ accountId: null, active: false, approved: false, role: "student", readOnly: true, source: "studentReadOnly" });
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("asks the core with the privileged check and renders for a Teacher", async () => {
    resolveAccess.mockResolvedValue({ accountId: "teacher-1", active: true, approved: true, role: "teacher", readOnly: false, source: "onlineGate" });
    renderGuard();
    expect(await screen.findByRole("heading", { name: "Class record" })).toBeInTheDocument();
    expect(resolveAccess).toHaveBeenCalledWith(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("hides a new Teacher page until its own online check finishes", async () => {
    const teacher: AuthContext = { accountId: "teacher-1", active: true, approved: true, role: "teacher", readOnly: false, source: "onlineGate" };
    resolveAccess.mockResolvedValue(teacher);
    const view = renderGuard();
    expect(await screen.findByRole("heading", { name: "Class record" })).toBeInTheDocument();
    resolveAccess.mockReturnValue(new Promise(() => {}));
    pathname = "/teach/drafts";
    view.rerender(<TeachGuard><h1>New Draft page</h1></TeachGuard>);
    expect(screen.queryByRole("heading", { name: "New Draft page" })).not.toBeInTheDocument();
    expect(resolveAccess).toHaveBeenCalledTimes(2);
  });
});
