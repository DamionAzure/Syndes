import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeOAuthCallback, signOutAccount } from "./oauth";

const exchangeCodeForSession = vi.fn();
const invoke = vi.fn();
const signOut = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args), signOut: (...args: unknown[]) => signOut(...args) } } }));

describe("OAuth return", () => {
  beforeEach(() => { exchangeCodeForSession.mockReset(); invoke.mockReset(); });

  it("exchanges only the expected desktop callback and lets the core verify the returned token", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: "opaque-token" } }, error: null });
    await completeOAuthCallback("syndes://auth/callback?code=one-time-code&sb_flow_id=flow-1");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("one-time-code", { flowId: "flow-1" });
    expect(invoke).toHaveBeenCalledWith("auth_online_login", { accessToken: "opaque-token" });
  });

  it("does not exchange a code from another callback address", async () => {
    await expect(completeOAuthCallback("https://other.example/auth/callback?code=one-time-code")).rejects.toThrow("invalid");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("explicit Account sign-out", () => {
  it("hides local Account data once native logout succeeds, without waiting for the network", async () => {
    invoke.mockResolvedValue(undefined);
    signOut.mockReturnValue(new Promise(() => {}));
    const hide = vi.fn();
    void signOutAccount(hide);
    await vi.waitFor(() => expect(hide).toHaveBeenCalledOnce());
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
