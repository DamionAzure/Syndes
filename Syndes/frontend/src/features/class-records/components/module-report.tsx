import type { ReportedModule } from "../class-record-types";
import { LOW_RESULT_PERCENT, MODULE_STATUS_LABEL, moduleStatus, resultPercent } from "../grading";
import { cn } from "@/lib/utils";

/** "4 of 5, 80%"; a low Result is marked in words, not only colour. */
export function ResultText({ report }: { report: ReportedModule }) {
  const percent = resultPercent(report);
  if (!report.result || percent === null) return null;
  const low = percent < LOW_RESULT_PERCENT;
  return (
    <span className={cn("tabular-nums", low && "font-medium text-destructive")}>
      {report.result.correct} of {report.result.total}, {percent}%{low ? ", below 60%" : ""}
    </span>
  );
}

/** Where a Learner is in a Module: the Result once submitted, otherwise their place. */
export function ModuleReport({ report }: { report: ReportedModule }) {
  const status = moduleStatus(report);
  if (report.result) return <ResultText report={report} />;
  if (status === "not-started") return <span className="text-muted-foreground">Not started</span>;
  if (status === "completed") return <span>{MODULE_STATUS_LABEL.completed}</span>;
  const place =
    report.lessonsReached >= report.lessonCount && report.questionCount > 0
      ? "Quiz not submitted"
      : `Lesson ${report.lessonsReached} of ${report.lessonCount}`;
  return <span className="text-muted-foreground">{place}</span>;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}
