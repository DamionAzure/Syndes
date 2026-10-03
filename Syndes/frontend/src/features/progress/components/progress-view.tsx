"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useModules } from "@/features/modules/module-source";
import { hrefForStep, routes } from "@/features/modules/routes";
import { Badge } from "@/components/ui/badge";
import { StepProgress } from "@/components/ui/step-progress";
import { placeLabel, placePosition } from "../place-label";
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

  if (saved.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
        <h2 className="text-section font-semibold">No saved progress yet</h2>
        <p className="max-w-[52ch] text-muted-foreground">
          When you start a module, your place and answers are saved here so you can continue later.
        </p>
        <Link href={routes.library()} className={buttonVariants({ variant: "outline", className: "mt-4" })}>
          Browse modules
        </Link>
      </div>
    );
  }

  return (
    <section aria-labelledby="saved-heading" className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 id="saved-heading" className="text-section font-semibold">
            Saved modules
          </h2>
          <p className="text-meta text-muted-foreground">
            {saved.length} {saved.length === 1 ? "module" : "modules"} with a saved place
          </p>
        </div>
        <ResetProgressDialog
          triggerLabel="Reset all progress"
          title="Reset all progress?"
          description="Your saved place and answers for every module will be removed from this device. This cannot be undone."
          confirmLabel="Reset all progress"
          onConfirm={() => updateProgress(() => resetAllProgress())}
          focusAfterResetId={headingId}
        />
      </div>
          <ul className="divide-y divide-border">
            {saved.map(({ summary, progress }) => {
              const position = placePosition(progress.step, summary);
              const completed = isCompleted(progress, summary);
              return (
              <li
                key={summary.id}
                className="grid gap-4 px-6 py-5 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-center md:gap-8"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-body font-semibold">{summary.title}</h3>
                    <Badge variant={completed ? "default" : "outline"}>
                      {completed ? "Completed" : "In progress"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-meta text-muted-foreground">{summary.subject}</p>
                </div>
                <StepProgress
                  current={position.current}
                  total={position.total}
                  label={placeLabel(progress.step, summary)}
                />
                <div className="flex flex-wrap gap-3 md:justify-end">
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
              );
            })}
          </ul>
    </section>
  );
}
