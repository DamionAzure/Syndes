"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { canTeach, STUDENT_FLOOR, type AuthContext } from "@/lib/access/access";
import { resolveAccess } from "@/lib/access/access-bridge";

export type AccessState = {
  /** "checking" until the core has answered; treat it like a Student until then. */
  status: "checking" | "ready";
  context: AuthContext;
  canTeach: boolean;
};

const CHECKING: AccessState = { status: "checking", context: STUDENT_FLOOR, canTeach: false };

const AccessContext = createContext<AccessState>(CHECKING);

/** Resolves the role once per app load, for navigation. Teacher pages check again themselves. */
export function AccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>(CHECKING);

  useEffect(() => {
    let active = true;
    void resolveAccess(false).then((context) => {
      if (active) setState({ status: "ready", context, canTeach: canTeach(context) });
    });
    return () => {
      active = false;
    };
  }, []);

  return <AccessContext.Provider value={state}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessState {
  return useContext(AccessContext);
}
