"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DraftIssue } from "../draft-checks";
import { useDraftSealer, type SealOutcome } from "../draft-sealer";
import type { ModuleDraft } from "../draft-types";
import { toDraftModuleFile } from "../module-file";

const OUTCOME_TEXT: Record<SealOutcome["status"], string> = {
  published: "Sealed and published. Approved Learners can find this Module.",
  unsupported:
    "Sealing and publishing require the Syndes desktop app. Your Draft stays saved on this device.",
  invalid: "This Draft was not published.",
};

/**
 * The margin keeps one question in view: can this draft be sealed yet?
 * Each issue links to the field that fixes it.
 */
export function SealPanel({
  draft,
  issues,
  onShowIssue,
}: {
  draft: ModuleDraft;
  issues: readonly DraftIssue[];
  onShowIssue: (issue: DraftIssue) => void;
}) {
  const sealer = useDraftSealer();
  const [outcome, setOutcome] = useState<SealOutcome | null>(null);
  const [sealing, setSealing] = useState(false);
  const ready = issues.length === 0;

  async function seal() {
    setSealing(true);
    try {
      setOutcome(await sealer.seal(toDraftModuleFile(draft)));
    } finally {
      setSealing(false);
    }
  }

  return (
    <section aria-labelledby="seal-heading" className="grid gap-5">
      <div>
        <h2 id="seal-heading" className="font-semibold">
          Before you seal
        </h2>
        <p className="text-meta text-muted-foreground">
          Sealing turns this Draft into a Module. Answers are locked in as checks before the Module is published.
        </p>
      </div>

      {ready ? (
        <p className="flex items-start gap-2 text-meta text-success">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Everything needed is in place.
        </p>
      ) : (
        <div className="grid gap-2">
          <p className="flex items-start gap-2 text-meta font-medium">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            {issues.length} {issues.length === 1 ? "thing" : "things"} to fix
          </p>
          <ul className="grid gap-1 border-l border-border pl-3">
            {issues.map((issue, index) => (
              <li key={`${issue.message}-${index}`}>
                <button
                  type="button"
                  onClick={() => onShowIssue(issue)}
                  className="min-h-9 text-left text-meta text-primary underline-offset-4 hover:underline"
                >
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-2">
        <Button onClick={seal} disabled={!ready || sealing} aria-describedby="seal-note">
          {sealing ? "Sealing and publishing…" : "Seal and publish"}
        </Button>
        <p id="seal-note" className="text-meta text-muted-foreground">
          {ready ? "You can keep editing after publishing; seal and publish again to share changes." : "Fix the items above to seal."}
        </p>
        {outcome ? (
          <p role="status" className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-meta">
            {outcome.status === "invalid" ? `${OUTCOME_TEXT.invalid} ${outcome.message}` : OUTCOME_TEXT[outcome.status]}
          </p>
        ) : null}
      </div>

      {draft.flashcards.length > 0 || draft.summary.trim() || draft.outcomes.trim() ? (
        <p className="border-t border-border pt-4 text-meta text-muted-foreground">
          The module file has no place yet for the summary, outcomes or flashcards. They stay in this draft and will be
          included once the file format supports them.
        </p>
      ) : null}
    </section>
  );
}
