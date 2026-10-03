"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpenText, FilePenLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/layout/wordmark";
import { identityProviderLabel, startOAuth } from "../oauth";
import { AuthIllustration } from "./auth-illustration";

export type AuthAudience = "student" | "teacher";

const COPY = {
  student: {
    eyebrow: "For students",
    title: "Learn with Syndes",
    description: "Find published Modules, keep your place, and study Modules marked Ready offline when you are disconnected.",
    information: "Your answers and Progress stay with your Account on this device.",
    otherHref: "/auth/teacher",
    otherLabel: "Teacher sign in",
    Icon: BookOpenText,
  },
  teacher: {
    eyebrow: "For teachers",
    title: "Teach with Syndes",
    description: "Create Drafts, Seal Modules, and review your work in one calm teaching space.",
    information: "Teacher pages require an online permission check. An Administrator assigns Teacher permission; choosing this page does not grant it.",
    otherHref: "/auth/student",
    otherLabel: "Student sign in",
    Icon: FilePenLine,
  },
} as const;

export function AuthEntry({ audience }: { audience: AuthAudience }) {
  const copy = COPY[audience];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await startOAuth();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in could not start. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-2">
      <main className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <Wordmark />
          <Link className="text-meta font-medium text-primary underline-offset-4 hover:underline" href={copy.otherHref}>
            {copy.otherLabel}
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[29rem] flex-1 flex-col justify-center py-16">
          <div className="mb-7 flex size-12 items-center justify-center rounded-lg border border-border bg-surface-muted text-primary">
            <copy.Icon aria-hidden="true" className="size-6" />
          </div>
          <p className="mb-3 text-meta font-semibold uppercase tracking-[0.16em] text-primary">{copy.eyebrow}</p>
          <h1 className="text-title font-semibold tracking-tight text-foreground">{copy.title}</h1>
          <p className="mt-4 text-body text-muted-foreground">{copy.description}</p>

          <form onSubmit={submit} className="mt-10 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            <h2 className="text-section font-semibold">Sign in or create your Account</h2>
            <p className="mt-2 text-meta text-muted-foreground">
              Continue with {identityProviderLabel}. A new Account waits for school approval before it can open Modules.
            </p>
            {error ? <p role="alert" className="mt-5 rounded-md bg-destructive/10 p-3 text-meta text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy} className="mt-6 w-full justify-center">
              {busy ? `Opening ${identityProviderLabel}…` : `Continue with ${identityProviderLabel}`}
              <ArrowRight aria-hidden="true" className="ml-2 size-4" />
            </Button>
            <p className="mt-5 text-meta text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="mr-2 inline size-4 align-[-3px] text-primary" />
              School approval is required before learning starts.
            </p>
          </form>

          <p className="mt-7 text-meta leading-relaxed text-muted-foreground">{copy.information}</p>
        </div>
        <p className="text-meta text-muted-foreground">Syndes · Learn at your own pace</p>
      </main>

      <AuthIllustration audience={audience} />
    </div>
  );
}
