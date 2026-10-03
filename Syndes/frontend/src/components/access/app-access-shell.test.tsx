import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppAccessShell } from "./app-access-shell";

const useAccess = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/modules" }));
vi.mock("./access-provider", () => ({ useAccess: () => useAccess() }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div> }));

describe("application access", () => {
  it("keeps a signed-in Pending Account outside learning pages", () => {
    useAccess.mockReturnValue({
      status: "ready",
      accountId: "person-1",
      context: { accountId: "person-1", active: true, approved: false, role: "student", readOnly: true, source: "onlineVerified" },
      canTeach: false,
    });

    render(<AppAccessShell><h1>Published Modules</h1></AppAccessShell>);
    expect(screen.getByRole("heading", { name: /waiting for school approval/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Published Modules" })).not.toBeInTheDocument();
  });
});
