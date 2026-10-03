"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyLibrary } from "@/features/modules/components/empty-library";
import { ModuleRow } from "@/features/modules/components/module-row";
import { OpenModuleFile } from "@/features/modules/components/open-module-file";
import { useModules } from "@/features/modules/module-source";
import { routes } from "@/features/modules/routes";
import { continueTarget } from "@/features/progress/progress-store";
import { useProgressStore } from "@/features/progress/use-progress";
import { ContinueSection } from "./continue-section";
import { OtherWaysToStudy } from "./other-ways-to-study";

const RECENT_LIMIT = 3;

/**
 * Main column: what to do next (Continue, then your modules). Side column:
 * secondary ways in. Wide screens use both; narrow screens stack them in
 * that order.
 */
export function HomeView() {
  const modules = useModules();
  const store = useProgressStore();
  const onDevice = modules.filter((summary) => summary.readyOffline);
  const target = continueTarget(store, onDevice);
  const targetSummary = target
    ? onDevice.find((summary) => summary.id === target.moduleId)
    : undefined;

  if (modules.length === 0) return <EmptyLibrary />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="grid min-w-0 gap-6">
        {target && targetSummary ? (
          <ContinueSection summary={targetSummary} progress={target} />
        ) : null}

        <Card className="gap-0 pb-0">
          <CardHeader className="border-b pb-5">
            <CardTitle id="your-modules-heading">Your modules</CardTitle>
            <CardDescription>
              {onDevice.length} of {modules.length} ready on this device
            </CardDescription>
            <CardAction>
              <Link href={routes.library()} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Browse all modules
              </Link>
            </CardAction>
          </CardHeader>
          <ul aria-labelledby="your-modules-heading" className="divide-y divide-border">
            {modules.slice(0, RECENT_LIMIT).map((summary) => (
              <ModuleRow key={summary.id} summary={summary} />
            ))}
          </ul>
        </Card>
      </div>

      <aside aria-label="More ways in" className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle level="h2">Add a module</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-muted-foreground">
              Got a module file from your teacher? Open it to add it to this device.
            </p>
            <OpenModuleFile variant={targetSummary ? "outline" : "default"} />
          </CardContent>
        </Card>
        <OtherWaysToStudy modules={onDevice} />
      </aside>
    </div>
  );
}
