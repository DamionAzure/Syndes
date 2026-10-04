import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/access/access";
import { AdminGuard } from "./admin-guard";

const replace = vi.fn();
const resolveAccess = vi.fn<(requirePrivileged: boolean) => Promise<AuthContext>>();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/access/access-bridge", () => ({
  resolveAccess: (requirePrivileged: boolean) => resolveAccess(requirePrivileged),
}));

function renderGuard() {
  return render(
    <AdminGuard>
      <h1>People and access</h1>
    </AdminGuard>,
  );
}

describe("AdminGuard", () => {
  beforeEach(() => {
    replace.mockReset();
    resolveAccess.mockReset();
  });

  it.each([
    { accountId: "student-1", active: true, approved: true, role: "student", readOnly: false, source: "offlineVerified" },
    { accountId: "teacher-1", active: true, approved: true, role: "teacher", readOnly: false, source: "offlineVerified" },
    { accountId: null, active: false, approved: false, role: "student", readOnly: true, source: "studentReadOnly" },
  ] as const)("sends a $role ($source) to Home without rendering", async (context) => {
    resolveAccess.mockResolvedValue(context);
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("heading", { name: "People and access" })).not.toBeInTheDocument();
  });

  it("renders for a verified Administrator", async () => {
    resolveAccess.mockResolvedValue({ accountId: "admin-1", active: true, approved: true, role: "admin", readOnly: false, source: "onlineGate" });
    renderGuard();
    expect(await screen.findByRole("heading", { name: "People and access" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
