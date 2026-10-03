"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  changeLabel,
  chronological,
  percentLabel,
  pointChange,
  rate,
  ratesOf,
  snapshotLabel,
} from "../statistics";
import { useStatisticsSnapshots } from "../statistics-source";
import type { StatisticsSnapshot } from "../statistics-types";

function counted(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

/** Same period last school year when there is one, otherwise the snapshot before. */
function comparisonFor(latest: StatisticsSnapshot, ordered: readonly StatisticsSnapshot[]) {
  const before = ordered.filter((snapshot) => Date.parse(snapshot.capturedAt) < Date.parse(latest.capturedAt));
  const samePeriod = [...before].reverse().find((snapshot) => snapshot.period === latest.period);
  const previous = samePeriod ?? before.at(-1);
  if (!previous) return null;
  return { snapshot: previous, label: samePeriod ? `${latest.period} last school year` : snapshotLabel(previous) };
}

function Figure({
  term,
  value,
  basis,
  change,
  tone,
}: {
  term: string;
  value: string;
  basis: string;
  change: string | null;
  tone?: "failing";
}) {
  return (
    <div className="grid content-start gap-1 border-border py-4 sm:px-6 sm:first:pl-0 lg:border-l lg:first:border-l-0">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className={cn("text-title font-semibold tabular-nums", tone === "failing" && "text-destructive")}>{value}</dd>
      <dd className="text-meta text-muted-foreground tabular-nums">{basis}</dd>
      {change ? <dd className="text-meta tabular-nums">{change}</dd> : null}
    </div>
  );
}

/**
 * The latest count first, as four figures read left to right, then every
 * count in order so a trend is something the Administrator can check, not
 * a line to trust.
 */
export function SchoolStatistics() {
  const ordered = chronological(useStatisticsSnapshots());
  const latest = ordered.at(-1);

  if (!latest) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
        <h2 className="text-section font-semibold">No counts yet</h2>
        <p className="text-muted-foreground">School statistics appear after the first grading period&apos;s grades are final.</p>
      </section>
    );
  }

  const rates = ratesOf(latest);
  const comparison = comparisonFor(latest, ordered);
  const previous = comparison ? ratesOf(comparison.snapshot) : null;
  const versus = (current: number | null, before: number | null | undefined) => {
    const text = changeLabel(pointChange(current, before ?? null));
    return text && comparison ? `${text} from ${comparison.label}` : null;
  };
  const passingWidth = rates.passingRate ?? 0;

  return (
    <div className="grid gap-6">
      <section aria-labelledby="standing-heading" className="rounded-xl border border-border bg-surface px-6 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="standing-heading" className="text-section font-semibold">
            {snapshotLabel(latest)}
          </h2>
          <p className="text-meta text-muted-foreground">
            Counted <time dateTime={latest.capturedAt}>{counted(latest.capturedAt)}</time>
          </p>
        </div>

        <dl className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            term="Enrolled"
            value={String(latest.enrolled)}
            basis={`of ${latest.enrolledAtStart} at the start of the year`}
            change={comparison ? `${comparison.snapshot.enrolled} in ${comparison.label}` : null}
          />
          <Figure
            term="Passing rate"
            value={percentLabel(rates.passingRate)}
            basis={`${latest.passing} of ${latest.assessed} assessed`}
            change={versus(rates.passingRate, previous?.passingRate)}
          />
          <Figure
            term="Failing rate"
            value={percentLabel(rates.failingRate)}
            basis={`${latest.failing} of ${latest.assessed} assessed`}
            change={versus(rates.failingRate, previous?.failingRate)}
            tone="failing"
          />
          <Figure
            term="Drop rate"
            value={percentLabel(rates.dropRate)}
            basis={`${latest.dropped} of ${latest.enrolledAtStart} since the year began`}
            change={versus(rates.dropRate, previous?.dropRate)}
          />
        </dl>

        <div className="mt-4 grid gap-2">
          <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-sm bg-surface-muted">
            <span className="bg-primary" style={{ width: `${passingWidth}%` }} />
            <span className="bg-destructive" style={{ width: `${rates.failingRate ?? 0}%` }} />
          </div>
          <p className="text-meta text-muted-foreground">
            Of {latest.assessed} assessed learners, {latest.passing} have a general average of 75 or higher and{" "}
            {latest.failing} are below 75.
          </p>
        </div>
      </section>

      <section aria-labelledby="trend-heading" className="overflow-hidden rounded-xl border border-border bg-surface">
        <h2 id="trend-heading" className="border-b border-border px-6 py-4 font-semibold">
          Every count
        </h2>
        <Table label="School statistics by grading period">
          <TableCaption>
            Passing and failing rates are shares of assessed learners. The drop rate is a share of learners enrolled at the
            start of the school year.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Grading period</TableHead>
              <TableHead scope="col">Counted</TableHead>
              <TableHead scope="col" className="text-right">
                Enrolled
              </TableHead>
              <TableHead scope="col" className="text-right">
                Passing
              </TableHead>
              <TableHead scope="col" className="text-right">
                Failing
              </TableHead>
              <TableHead scope="col" className="text-right">
                Drop rate
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...ordered].reverse().map((snapshot) => {
              const row = ratesOf(snapshot);
              return (
                <TableRow key={snapshot.id}>
                  <TableHead scope="row" className="font-medium text-foreground">
                    {snapshotLabel(snapshot)}
                  </TableHead>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <time dateTime={snapshot.capturedAt}>{counted(snapshot.capturedAt)}</time>
                  </TableCell>
                  <TableCell className="text-right">{snapshot.enrolled}</TableCell>
                  <TableCell className="text-right">{percentLabel(row.passingRate)}</TableCell>
                  <TableCell className="text-right">{percentLabel(row.failingRate)}</TableCell>
                  <TableCell className="text-right">{percentLabel(row.dropRate)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {latest.sections.length > 0 ? (
        <section aria-labelledby="by-section-heading" className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-6 py-4">
            <h2 id="by-section-heading" className="font-semibold">
              By section
            </h2>
            <p className="text-meta text-muted-foreground">{snapshotLabel(latest)}</p>
          </div>
          <Table label={`Statistics by section, ${snapshotLabel(latest)}`}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Section</TableHead>
                <TableHead scope="col" className="text-right">
                  Enrolled
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Passing
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Failing
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Dropped
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latest.sections.map((section) => (
                <TableRow key={section.sectionId}>
                  <TableHead scope="row" className="font-medium text-foreground">
                    {section.label}
                  </TableHead>
                  <TableCell className="text-right">{section.enrolled}</TableCell>
                  <TableCell className="text-right">
                    {section.passing}{" "}
                    <span className="text-muted-foreground">({percentLabel(rate(section.passing, section.assessed))})</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {section.failing}{" "}
                    <span className="text-muted-foreground">({percentLabel(rate(section.failing, section.assessed))})</span>
                  </TableCell>
                  <TableCell className="text-right">{section.dropped}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}
