"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { completeOAuthCallback } from "@/features/auth/oauth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void completeOAuthCallback(window.location.href).then(
      () => { if (active) router.replace("/"); },
      (cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Sign in could not finish."); },
    );
    return () => { active = false; };
  }, [router]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center">
        <h1 className="text-page font-semibold">{error ? "Sign in needs another try" : "Finishing sign in…"}</h1>
        {error ? <><p role="alert" className="mt-4 text-body text-destructive">{error}</p><Link href="/auth/student" className="mt-6 inline-block text-primary underline">Back to sign in</Link></> : <p role="status" className="mt-4 text-body text-muted-foreground">Checking your school Account.</p>}
      </div>
    </main>
  );
}
