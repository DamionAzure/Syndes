"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useAccess } from "@/components/access/access-provider";
import { Button } from "@/components/ui/button";
import { canLearn, canTeach } from "@/lib/access/access";
import { resolveAccess } from "@/lib/access/access-bridge";
import { DRAFTS_KEY } from "@/features/authoring/draft-store";
import { PROGRESS_KEY } from "@/features/progress/progress-store";
import { importLegacyDrafts, importLegacyLearningData } from "../legacy-import";

export function LegacyImport({ kind }: { kind: "progress" | "drafts" }) {
  const access = useAccess();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const key = kind === "progress" ? PROGRESS_KEY : DRAFTS_KEY;
  const subscribe = useCallback((notify: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) notify();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  const available = useSyncExternalStore(subscribe, () => window.localStorage.getItem(key) !== null, () => false);
  if (!access.accountId || !available) return null;

  async function importData() {
    setBusy(true);
    const result = kind === "progress"
      ? importLegacyLearningData(window.localStorage, access.accountId, canLearn(access.context))
      : importLegacyDrafts(window.localStorage, access.accountId, canTeach(await resolveAccess(true)));
    setBusy(false);
    if (result.status === "denied") setMessage("This Account cannot import that data now.");
    else if (result.status === "already-imported") setMessage("This Account already imported its legacy data.");
    else setMessage(kind === "progress"
      ? `Imported ${result.progressCount} saved module places into this Account.`
      : `Imported ${result.draftCount} Drafts into this Account.`);
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-surface p-6" aria-label={`Import legacy ${kind}`}>
      <h2 className="text-body font-semibold">Older device data</h2>
      <p className="text-meta text-muted-foreground">
        Older {kind === "progress" ? "Progress" : "Drafts"} on this device has no Account owner. Choose this once to copy it into your Account. Existing Account work is kept.
      </p>
      <Button variant="outline" className="justify-self-start" onClick={() => void importData()} disabled={busy}>
        {busy ? "Importing…" : `Import older ${kind === "progress" ? "Progress" : "Drafts"}`}
      </Button>
      {message ? <p role="status" className="text-meta">{message}</p> : null}
    </section>
  );
}
