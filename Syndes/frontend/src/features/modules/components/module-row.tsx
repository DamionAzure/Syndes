import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ModuleSummary } from "../module-types";
import { routes } from "../routes";
import { Availability } from "./availability";

export function lessonCountLabel(count: number): string {
  return `${count} ${count === 1 ? "lesson" : "lessons"}`;
}

/** Aligned Library row: subject and title left, count and availability right. */
export function ModuleRow({
  summary,
  headingLevel = "h3",
}: {
  summary: ModuleSummary;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <li className="grid gap-4 border-b border-border py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-meta text-muted-foreground">{summary.subject}</p>
        <Heading className="text-section font-semibold">{summary.title}</Heading>
        <p className="mt-1 max-w-[62ch] text-muted-foreground">{summary.summary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:justify-end">
        <div className="text-meta text-muted-foreground sm:text-right">
          <p>{lessonCountLabel(summary.lessonCount)}</p>
          <Availability readyOffline={summary.readyOffline} />
        </div>
        {summary.readyOffline ? (
          <Link
            href={routes.module(summary.id)}
            className={cn(buttonVariants({ variant: "outline" }))}
            aria-label={`Open module: ${summary.title}`}
          >
            Open module
          </Link>
        ) : null}
      </div>
    </li>
  );
}
