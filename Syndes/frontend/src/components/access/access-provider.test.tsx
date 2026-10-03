import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessProvider, useAccess } from "./access-provider";

const invoke = vi.fn();
const resolveAccess = vi.fn();
const refreshSession = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/plugin-deep-link", () => ({ onOpenUrl: async () => () => {}, getCurrent: async () => null }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/lib/access/access-bridge", () => ({ resolveAccess: (...args: unknown[]) => resolveAccess(...args) }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: async () => ({ data: { session: null }, error: null }),
    refreshSession: (...args: unknown[]) => refreshSession(...args),
  } },
}));

function AccessProbe() {
  const { accountId, error } = useAccess();
  return <p>{accountId ?? "signed out"}{error ? ` · ${error}` : ""}</p>;
}

describe("Account reconnection", () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue(undefined);
    resolveAccess.mockReset().mockResolvedValue({ accountId: "student-1", active: true, approved: true, role: "student", readOnly: false, source: "offlineVerified" });
    refreshSession.mockReset();
  });

  it("hides retained local work when Supabase says the session is definitively invalid", async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: new AuthApiError("invalid refresh token", 401, "refresh_token_not_found") });
    render(<AccessProvider><AccessProbe /></AccessProvider>);
    expect(await screen.findByText("student-1")).toBeInTheDocument();

    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.getByText(/signed out · Your sign-in has ended/i)).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("auth_logout");
  });

  it("keeps the approved offline grant when refresh fails for a temporary network reason", async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError("offline", 0) });
    render(<AccessProvider><AccessProbe /></AccessProvider>);
    expect(await screen.findByText("student-1")).toBeInTheDocument();

    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(refreshSession).toHaveBeenCalledOnce());
    expect(screen.getByText("student-1")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("auth_logout");
  });
});
