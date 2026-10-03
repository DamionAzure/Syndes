"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ActionResult } from "../directory-actions";
import { runDirectoryAction } from "../use-directory";

export type Feedback = { ok: boolean; message: string } | null;

/**
 * Runs Administrator changes and keeps the outcome in words. Success is
 * announced politely; a refusal says why, as an alert, and nothing changes.
 */
export function useDirectoryAction(): {
  feedback: Feedback;
  run: (action: Parameters<typeof runDirectoryAction>[0]) => ActionResult;
  clear: () => void;
} {
  const [feedback, setFeedback] = useState<Feedback>(null);
  return {
    feedback,
    run: (action) => {
      const result = runDirectoryAction(action);
      setFeedback({ ok: result.ok, message: result.message });
      return result;
    },
    clear: () => setFeedback(null),
  };
}

/** Both live regions stay mounted so screen readers announce the first message too. */
export function ActionFeedback({ feedback, className }: { feedback: Feedback; className?: string }) {
  const box = "flex items-start gap-2 rounded-lg border px-4 py-3 text-meta";
  return (
    <div className={cn("empty:hidden", className)}>
      <div role="status" className="empty:hidden">
        {feedback?.ok ? (
          <p className={cn(box, "border-border bg-surface-muted text-foreground")}>
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            {feedback.message}
          </p>
        ) : null}
      </div>
      <div role="alert" className="empty:hidden">
        {feedback && !feedback.ok ? (
          <p className={cn(box, "border-destructive/40 bg-destructive/5 text-destructive")}>
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {feedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
