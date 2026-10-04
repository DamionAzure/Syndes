"use client";

import { useEffect, useState } from "react";
import { useAccess } from "@/components/access/access-provider";
import { Button } from "@/components/ui/button";
import { ADMIN_PATH, LEARN_HOME, TEACH_PATH, type Role } from "@/lib/access/access";
import { demoSignIn, demoSignInAvailable, demoSignOut, readAppError } from "@/lib/bridge";

const ROLES: readonly Role[] = ["student", "teacher", "admin"];
const LABEL: Record<Role, string> = { student: "Learner", teacher: "Teacher", admin: "Administrator" };
const DESTINATION: Record<Role, string> = { student: LEARN_HOME, teacher: TEACH_PATH, admin: ADMIN_PATH };

/**
 * Faux sign-in for demos, until the real Supabase sign-in screen exists. It
 * renders only when the Rust core says this is a debug build
 * (`auth_demo_available`); in a release build, or a plain browser, it renders
 * nothing. The core holds the chosen role in memory and labels it `demo`, so it
 * is never mistaken for a verified sign-in.
 */
export function DemoSignIn() {
  const access = useAccess();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void demoSignInAvailable().then((ok) => {
      if (active) setAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;

  const current = access.context.source === "demo" ? access.context.role : null;

  async function pick(role: Role) {
    setBusy(true);
    setError(null);
    try {
      await demoSignIn(role);
      // Full reload so navigation and every role guard ask the core again.
      window.location.assign(DESTINATION[role]);
    } catch (cause) {
      setError(readAppError(cause).message);
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await demoSignOut();
      window.location.assign(LEARN_HOME);
    } catch (cause) {
      setError(readAppError(cause).message);
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="demo-sign-in-heading"
      className="grid gap-3 rounded-lg border border-dashed border-border p-4"
    >
      <div>
        <h2 id="demo-sign-in-heading" className="font-semibold">
          Demo sign-in
        </h2>
        <p className="text-meta text-muted-foreground">
          Development builds only. Choose who to act as. Nothing is verified, and it resets when the app restarts.
        </p>
      </div>
      <p role="status" className="text-meta">
        {current ? `Acting as ${LABEL[current]} (demo).` : "Not using a demo role."}
      </p>
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <Button
            key={role}
            variant={current === role ? "default" : "outline"}
            aria-pressed={current === role}
            disabled={busy}
            onClick={() => void pick(role)}
          >
            Act as {LABEL[role]}
          </Button>
        ))}
        {current ? (
          <Button variant="ghost" disabled={busy} onClick={() => void signOut()}>
            Sign out
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-meta text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
