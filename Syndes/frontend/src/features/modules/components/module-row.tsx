import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ModuleSummary } from "../module-types";
import { routes } from "../routes";
import { Availability } from "./availability";

export function lessonCountLabel(count: number): string {
  return `${count} ${count === 1 ? "lesson" : "lessons"}`;
}

/**
 * One Module in a list panel: subject and title lead, the summary sits
 * under them, and facts plus the open action align on the right.
 */
export function ModuleRow({
  summary,
  headingLevel = "h3",
}: {
  summary: ModuleSummary;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <li className="grid gap-4 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
      <div className="min-w-0">
        <Badge variant="secondary" className="text-muted-foreground">
          {summary.subject}
        </Badge>
        <Heading className="mt-2 text-body font-semibold">{summary.title}</Heading>
        <p className="mt-1 line-clamp-2 max-w-[62ch] text-meta text-muted-foreground">{summary.summary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:justify-end">
        <div className="grid gap-1 text-meta text-muted-foreground sm:text-right">
          <p>{lessonCountLabel(summary.lessonCount)}</p>
          <Availability readyOffline={summary.readyOffline} className="sm:justify-end" />
        </div>
        {summary.readyOffline ? (
          <Link
            href={routes.module(summary.id)}
            className={buttonVariants({ variant: "outline" })}
            aria-label={`Open module: ${summary.title}`}
          >
            Open module
          </Link>
        ) : null}
      </div>
    </li>
  );
}
