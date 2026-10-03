"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/layout/local-data-boundary";
import { canTeach, LEARN_HOME } from "@/lib/access/access";
import { resolveAccess } from "@/lib/access/access-bridge";

type GuardState = "checking" | "allowed" | "denied";

/**
 * Renders Teacher pages only after the Rust core confirms a Teacher or Admin;
 * anyone else is sent to Home. Nothing inside renders while checking, and the
 * static HTML holds only the checking state.
 *
 * This is the usability layer. The enforcement is in the core: teacher
 * commands refuse callers without a verified Teacher role (ADR-0005).
 */
export function TeachGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let active = true;
    void resolveAccess(true).then((context) => {
      if (!active) return;
      const allowed = canTeach(context);
      setState(allowed ? "allowed" : "denied");
      // Replace, so Back does not return to a page the Learner cannot open.
      if (!allowed) router.replace(LEARN_HOME);
    });
    return () => {
      active = false;
    };
  }, [router]);

  if (state === "allowed") return children;
  return (
    <LoadingState
      label={state === "checking" ? "Checking your access…" : "Teacher pages are for teachers only. Taking you to Home…"}
    />
  );
}
