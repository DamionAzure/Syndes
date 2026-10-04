"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { canLearn, isTeachPath } from "@/lib/access/access";
import { useAccess } from "./access-provider";

export function AppAccessShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, accountId, context, canTeach, signOut, error } = useAccess();
  if (pathname.startsWith("/auth/")) return children;
  if (status === "checking") return <div role="status" className="grid min-h-dvh place-items-center text-muted-foreground">Checking your Account…</div>;

  if (!accountId) {
    return <AccessMessage title={error ? "Sign in needs another try" : "Welcome to Syndes"} description={error ?? "Sign in with your school-approved Account to open Modules."} action={<><Link href="/auth/student" className="text-primary underline">Student sign in</Link><Link href="/auth/teacher" className="text-primary underline">Teacher sign in</Link></>} />;
  }
  if (!context.active) {
    return <AccessMessage title="Account access removed" description="This Account can no longer open Modules. Your local work is retained and will reappear if access is restored." action={<Button onClick={() => void signOut()}>Sign out</Button>} />;
  }
  if (!canLearn(context) && !(isTeachPath(pathname) && canTeach)) {
    return <AccessMessage title="Waiting for school approval" description="Your Account is signed in. An Administrator must approve learning access before you can open Modules, including files on this device." action={<Button onClick={() => void signOut()}>Sign out</Button>} />;
  }
  return <AppShell>{children}</AppShell>;
}

function AccessMessage({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 text-center">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface px-7 py-10 shadow-sm">
        <p className="text-meta font-semibold uppercase tracking-[0.16em] text-primary">Syndes Account</p>
        <h1 className="mt-4 text-page font-semibold">{title}</h1>
        <p className="mt-4 text-body text-muted-foreground">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-5">{action}</div>
      </div>
    </main>
  );
}
