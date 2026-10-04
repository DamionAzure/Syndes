"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/layout/local-data-boundary";
import { LEARN_HOME, type AuthContext } from "@/lib/access/access";
import { resolveAccess } from "@/lib/access/access-bridge";

type GuardState = "checking" | "allowed" | "denied";

/**
 * Renders a section only after the Rust core confirms the role it needs;
 * anyone else is sent to Home. Nothing inside renders while checking, and the
 * static HTML holds only the checking state.
 *
 * This is the usability layer. Enforcement lives where the data does: the
 * core for teacher commands. Administrator pages currently contain sample
 * local data (ADR-0008 proposal).
 */
export function RoleGuard({
  allow,
  deniedLabel,
  children,
}: {
  allow: (context: AuthContext) => boolean;
  deniedLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let active = true;
    const check = () => {
      void resolveAccess(true).then((context) => {
        if (!active) return;
        const allowed = allow(context);
        setState(allowed ? "allowed" : "denied");
        if (!allowed) router.replace(LEARN_HOME);
      });
    };
    check();
    window.addEventListener("online", check);
    return () => {
      active = false;
      window.removeEventListener("online", check);
    };
  }, [allow, router]);

  if (state === "allowed") return children;
  return <LoadingState label={state === "checking" ? "Checking your access…" : deniedLabel} />;
}
