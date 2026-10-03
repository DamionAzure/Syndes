"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useModules } from "@/features/modules/module-source";
import { hrefForStep, routes } from "@/features/modules/routes";
import { placeLabel } from "../place-label";
import {
  isCompleted,
  readModuleProgress,
  resetAllProgress,
  resetModuleProgress,
} from "../progress-store";
import { updateProgress, useProgressStore } from "../use-progress";
import { ResetProgressDialog } from "./reset-progress-dialog";

export function ProgressView({ headingId }: { headingId: string }) {
  const modules = useModules();
  const store = useProgressStore();
  const saved = modules.flatMap((summary) => {
    const { progress } = readModuleProgress(store, summary);
    return progress ? [{ summary, progress }] : [];
  });

  return (
    <div className="mx-auto max-w-[56rem]">
      {saved.length === 0 ? (
        <div className="mt-10 border-y border-border py-8">
          <h2 className="text-section font-semibold">No saved progress yet</h2>
          <p className="mt-2 max-w-[62ch] text-muted-foreground">
            When you start a module, your place and answers are saved here so you can continue later.
          </p>
          <Link href={routes.library()} className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            Browse modules
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-10 border-t border-border">
            {saved.map(({ summary, progress }) => (
              <li
                key={summary.id}
                className="grid gap-4 border-b border-border py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <h2 className="text-section font-semibold">{summary.title}</h2>
                  <p className="text-meta text-muted-foreground">
                    {placeLabel(progress.step, summary)} ·{" "}
                    {isCompleted(progress, summary) ? "Completed" : "In progress"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={hrefForStep(summary.id, progress.step)}
                    className={buttonVariants()}
                    aria-label={`Continue ${summary.title}`}
                  >
                    Continue
                  </Link>
                  <ResetProgressDialog
                    triggerLabel="Reset progress"
                    title={`Reset progress for ${summary.title}?`}
                    description="Your saved place and answers for this module will be removed from this device. This cannot be undone."
                    confirmLabel="Reset progress"
                    onConfirm={() => updateProgress((current) => resetModuleProgress(current, summary.id))}
                    focusAfterResetId={headingId}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <ResetProgressDialog
              triggerLabel="Reset all progress"
              title="Reset all progress?"
              description="Your saved place and answers for every module will be removed from this device. This cannot be undone."
              confirmLabel="Reset all progress"
              onConfirm={() => updateProgress(() => resetAllProgress())}
              focusAfterResetId={headingId}
            />
          </div>
        </>
      )}
    </div>
  );
}
