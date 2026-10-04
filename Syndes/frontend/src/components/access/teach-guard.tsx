"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/layout/local-data-boundary";
import { canTeach, LEARN_HOME } from "@/lib/access/access";
import { resolveAccess } from "@/lib/access/access-bridge";

type GuardState = "checking" | "allowed" | "denied";

/** Teacher pages require a fresh online Teacher or Administrator grant (ADR-0004). */
export function TeachGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [decision, setDecision] = useState<{ pathname: string; state: GuardState }>({ pathname: "", state: "checking" });

  useEffect(() => {
    let active = true;
    const check = () => {
      void resolveAccess(true).then((context) => {
        if (!active) return;
        const allowed = canTeach(context);
        setDecision({ pathname, state: allowed ? "allowed" : "denied" });
        // Replace, so Back does not return to a page the Learner cannot open.
        if (!allowed) router.replace(LEARN_HOME);
      });
    };
    check();
    // Existing local Draft edits can save while offline; on reconnect, recheck
    // current permission and remove the page if the Account was revoked.
    window.addEventListener("online", check);
    return () => {
      active = false;
      window.removeEventListener("online", check);
    };
  }, [pathname, router]);

  const state = decision.pathname === pathname ? decision.state : "checking";
  if (state === "allowed") return children;
  return <LoadingState label={state === "checking" ? "Checking your access…" : "Teacher pages require current Teacher or Administrator access. Taking you to Home…"} />;
}
