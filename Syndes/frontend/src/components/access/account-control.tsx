"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "./access-provider";

export function AccountControl({ compact = false }: { compact?: boolean }) {
  const { accountId, signOut } = useAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!accountId) return null;

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError("Sign out could not finish. Try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void leave()} aria-label="Sign out">
        <LogOut aria-hidden="true" className="size-4" />{compact ? null : <span>Sign out</span>}
      </Button>
      {error ? <p role="alert" className="mt-2 text-meta text-destructive">{error}</p> : null}
    </div>
  );
}
