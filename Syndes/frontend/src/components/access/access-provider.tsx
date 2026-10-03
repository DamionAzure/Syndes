"use client";

import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { canTeach, STUDENT_FLOOR, type AuthContext } from "@/lib/access/access";
import { resolveAccess } from "@/lib/access/access-bridge";
import { supabase } from "@/lib/supabase";
import { setActiveAccountId } from "@/lib/active-account";
import { completeOAuthCallback, signOutAccount } from "@/features/auth/oauth";

export type AccessState = {
  status: "checking" | "ready";
  context: AuthContext;
  canTeach: boolean;
  /** Verified native Account identity; local stores use this partition only. */
  accountId: string | null;
  error: string | null;
  signOut: () => Promise<void>;
};

const CHECKING: AccessState = {
  status: "checking",
  context: STUDENT_FLOOR,
  canTeach: false,
  accountId: null,
  error: null,
  signOut: async () => {},
};

const AccessContext = createContext<AccessState>(CHECKING);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>(CHECKING);

  const reconcile = useCallback(async (session: Session | null): Promise<AuthContext> => {
    if (session && isTauri() && navigator.onLine) {
      try {
        await invoke("auth_online_login", { accessToken: session.access_token });
      } catch {
        // The native core still decides whether an existing offline grant survives.
      }
    }
    const resolved = await resolveAccess(false);
    // A stale browser session must never select a different native Account's data.
    return session && resolved.accountId && session.user.id !== resolved.accountId
      ? STUDENT_FLOOR
      : resolved;
  }, []);

  const signOut = useCallback(async () => {
    await signOutAccount(() => {
      setActiveAccountId(null);
      setState({ status: "ready", context: STUDENT_FLOOR, canTeach: false, accountId: null, error: null, signOut });
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const update = async (session: Session | null) => {
      const current = ++revision;
      try {
        const context = await reconcile(session);
        if (!mounted || current !== revision) return;
        setActiveAccountId(context.accountId);
        setState({ status: "ready", context, canTeach: canTeach(context), accountId: context.accountId, error: null, signOut });
      } catch (cause) {
        if (!mounted || current !== revision) return;
        setActiveAccountId(null);
        setState({ status: "ready", context: STUDENT_FLOOR, canTeach: false, accountId: null,
          error: cause instanceof Error ? cause.message : "Account access could not be checked.", signOut });
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase warns against awaiting another auth method inside this callback.
      window.setTimeout(() => { void update(session); }, 0);
    });
    void supabase.auth.getSession().then(({ data }) => update(data.session), () => update(null));

    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      const handledUrls = new Set<string>();
      const handle = async (url: string) => {
        if (handledUrls.has(url)) return;
        handledUrls.add(url);
        try {
          await completeOAuthCallback(url);
          const { data } = await supabase.auth.getSession();
          await update(data.session);
        } catch (cause) {
          if (!mounted) return;
          setState((current) => ({ ...current, error: cause instanceof Error ? cause.message : "Sign in could not finish." }));
        }
      };
      void onOpenUrl((urls) => { for (const url of urls) void handle(url); }).then((stop) => { if (mounted) unlisten = stop; else stop(); }, () => {});
      void getCurrent().then((urls) => { for (const url of urls ?? []) void handle(url); }, () => {});
    }
    const online = () => { void supabase.auth.refreshSession().then(({ data }) => update(data.session), () => update(null)); };
    window.addEventListener("online", online);
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      unlisten?.();
      window.removeEventListener("online", online);
    };
  }, [reconcile, signOut]);

  return <AccessContext.Provider value={{ ...state, signOut }}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessState {
  return useContext(AccessContext);
}

export function useAccountId(): string | null {
  return useContext(AccessContext).accountId;
}
