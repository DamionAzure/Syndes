"use client";

import { Progress, ProgressLabel } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** A labeled progress bar whose visible text, e.g. "Lesson 2 of 6", is also its accessible value. */
export function StepProgress({
  current,
  total,
  label,
  className,
}: {
  current: number;
  total: number;
  label: string;
  className?: string;
}) {
  return (
    <Progress
      value={current}
      max={Math.max(total, 1)}
      getAriaValueText={() => label}
      className={cn("gap-2", className)}
    >
      <ProgressLabel className="text-meta font-normal text-muted-foreground">{label}</ProgressLabel>
    </Progress>
  );
}
