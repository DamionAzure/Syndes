"use client";

import Link from "next/link";
import { routes } from "@/features/modules/routes";
import { EmptyLibrary } from "@/features/modules/components/empty-library";
import { ModuleRow } from "@/features/modules/components/module-row";
import { OpenModuleFile } from "@/features/modules/components/open-module-file";
import { useModules } from "@/features/modules/module-source";
import { continueTarget } from "@/features/progress/progress-store";
import { useProgressStore } from "@/features/progress/use-progress";
import { ContinueSection } from "./continue-section";
import { OtherWaysToStudy } from "./other-ways-to-study";

const RECENT_LIMIT = 3;

export function HomeView() {
  const modules = useModules();
  const store = useProgressStore();
  const onDevice = modules.filter((summary) => summary.readyOffline);
  const target = continueTarget(store, onDevice);
  const targetSummary = target
    ? onDevice.find((summary) => summary.id === target.moduleId)
    : undefined;

  return (
    <div className="mx-auto grid max-w-[56rem] gap-12">
      <header>
        <h1 className="text-title font-semibold">Home</h1>
        <p className="mt-3 text-muted-foreground">
          {targetSummary
            ? "Pick up where you left off, or open another module."
            : "Open a module to start learning. Everything here works without a connection."}
        </p>
      </header>

      {target && targetSummary ? (
        <ContinueSection summary={targetSummary} progress={target} />
      ) : null}

      {modules.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <>
          <section aria-labelledby="open-file-heading" className="grid gap-3">
            <h2 id="open-file-heading" className="text-section font-semibold">
              Add a module
            </h2>
            <p className="max-w-[62ch] text-muted-foreground">
              Got a module file from your teacher? Open it to add it to this device.
            </p>
            <OpenModuleFile variant={targetSummary ? "outline" : "default"} />
          </section>

          <section aria-labelledby="your-modules-heading">
            <h2 id="your-modules-heading" className="text-page font-semibold">
              Your modules
            </h2>
            <ul className="mt-4 border-t border-border">
              {modules.slice(0, RECENT_LIMIT).map((summary) => (
                <ModuleRow key={summary.id} summary={summary} />
              ))}
            </ul>
            <Link
              href={routes.library()}
              className="mt-4 inline-flex min-h-(--control-height) items-center text-primary underline underline-offset-4"
            >
              Browse all modules
            </Link>
          </section>

          <OtherWaysToStudy modules={onDevice} />
        </>
      )}
    </div>
  );
}
