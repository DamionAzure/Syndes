import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { ModuleSummary } from "@/features/modules/module-types";
import { hrefForStep } from "@/features/modules/routes";
import { placeLabel } from "@/features/progress/place-label";
import type { ModuleProgress } from "@/features/progress/progress-types";

/** Rendered only when saved Progress exists; opens the exact saved place. */
export function ContinueSection({
  summary,
  progress,
}: {
  summary: ModuleSummary;
  progress: ModuleProgress;
}) {
  return (
    <section
      aria-labelledby="continue-heading"
      className="grid gap-4 border-l-2 border-primary bg-surface p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div>
        <h2 id="continue-heading" className="text-meta text-muted-foreground">
          Continue
        </h2>
        <p className="mt-1 text-section font-semibold">{summary.title}</p>
        <p className="mt-1 text-muted-foreground">{placeLabel(progress.step, summary)}</p>
      </div>
      <Link
        href={hrefForStep(summary.id, progress.step)}
        className={buttonVariants()}
        aria-label={`Continue ${summary.title}`}
      >
        Continue
      </Link>
    </section>
  );
}
