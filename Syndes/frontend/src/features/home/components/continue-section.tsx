import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StepProgress } from "@/components/ui/step-progress";
import type { ModuleSummary } from "@/features/modules/module-types";
import { hrefForStep } from "@/features/modules/routes";
import { placeLabel, placePosition } from "@/features/progress/place-label";
import type { ModuleProgress } from "@/features/progress/progress-types";

/**
 * The one emphasised element on Home: where the Learner left off, with how
 * far along they are. Rendered only when saved Progress exists.
 */
export function ContinueSection({
  summary,
  progress,
}: {
  summary: ModuleSummary;
  progress: ModuleProgress;
}) {
  const place = placeLabel(progress.step, summary);
  const { current, total } = placePosition(progress.step, summary);

  return (
    <section
      aria-labelledby="continue-heading"
      className="grid gap-6 rounded-xl border border-primary/40 bg-surface p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8"
    >
      <div className="min-w-0">
        <h2 id="continue-heading" className="text-meta text-primary">
          Continue where you left off
        </h2>
        <p className="mt-2 text-page leading-tight font-semibold">{summary.title}</p>
        <p className="mt-1 text-muted-foreground">{summary.subject}</p>
        <StepProgress current={current} total={total} label={place} className="mt-5 max-w-[24rem]" />
      </div>
      <Link
        href={hrefForStep(summary.id, progress.step)}
        className={buttonVariants({ size: "lg" })}
        aria-label={`Continue ${summary.title}`}
      >
        Continue
      </Link>
    </section>
  );
}
