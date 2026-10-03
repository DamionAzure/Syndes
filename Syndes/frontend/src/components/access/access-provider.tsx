"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { canTeach, STUDENT_FLOOR, type AuthContext } from "@/lib/access/access";
import { resolveAccess } from "@/lib/access/access-bridge";
import { supabase } from "@/lib/supabase";
import { setActiveAccountId } from "@/lib/active-account";

export type AccessState = {
  /** "checking" until the core has answered; treat it like a Student until then. */
  status: "checking" | "ready";
  context: AuthContext;
  canTeach: boolean;
  /**
   * The signed-in Account id (Supabase user id), or null when signed out. Used
   * ONLY to partition account-scoped local stores (ADR 0007); access decisions
   * come from `context`, which the Rust core resolves.
   */
  accountId: string | null;
};

const CHECKING: AccessState = {
  status: "checking",
  context: STUDENT_FLOOR,
  canTeach: false,
  accountId: null,
};

const AccessContext = createContext<AccessState>(CHECKING);

/** Resolves the role once per app load, for navigation. Teacher pages check again themselves. */
export function AccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>(CHECKING);

  useEffect(() => {
    let active = true;
    // Resolve the Rust core's access decision and the Supabase account id in
    // parallel; the id is for store partitioning only, never for access.
    void Promise.all([resolveAccess(false), supabase.auth.getUser()]).then(
      ([context, userResult]) => {
        if (!active) return;
        const accountId = userResult.data.user?.id ?? null;
        // Publish to the registry FIRST so account-scoped stores read the right
        // partition before any component renders against the new state.
        setActiveAccountId(accountId);
        setState({ status: "ready", context, canTeach: canTeach(context), accountId });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return <AccessContext.Provider value={state}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessState {
  return useContext(AccessContext);
}

/** The current Account id for store partitioning, or null when signed out. */
export function useAccountId(): string | null {
  return useContext(AccessContext).accountId;
}
