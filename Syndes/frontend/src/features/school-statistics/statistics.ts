import type { StatisticsSnapshot } from "./statistics-types";

/** A share as a percentage with one decimal, or null when there is nothing to divide by. */
export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export type Rates = {
  passingRate: number | null;
  failingRate: number | null;
  dropRate: number | null;
};

/**
 * Passing and failing are shares of assessed Learners, so they add up to
 * 100%. The drop rate is a share of everyone enrolled when the year began,
 * because a Learner who dropped is no longer counted as enrolled.
 */
export function ratesOf(
  snapshot: Pick<StatisticsSnapshot, "assessed" | "passing" | "failing" | "dropped" | "enrolledAtStart">,
): Rates {
  return {
    passingRate: rate(snapshot.passing, snapshot.assessed),
    failingRate: rate(snapshot.failing, snapshot.assessed),
    dropRate: rate(snapshot.dropped, snapshot.enrolledAtStart),
  };
}

/** Change in percentage points, one decimal, or null when either side is missing. */
export function pointChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 10) / 10;
}

export function percentLabel(value: number | null): string {
  return value === null ? "Not yet" : `${value.toFixed(1)}%`;
}

/** "up 1.2 points", "down 0.4 points", "no change"; direction in words, never colour alone. */
export function changeLabel(change: number | null): string | null {
  if (change === null) return null;
  if (change === 0) return "no change";
  const size = Math.abs(change).toFixed(1);
  return `${change > 0 ? "up" : "down"} ${size} ${size === "1.0" ? "point" : "points"}`;
}

/** Oldest first, so tables read as a timeline. */
export function chronological(snapshots: readonly StatisticsSnapshot[]): StatisticsSnapshot[] {
  return [...snapshots].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
}

export function snapshotLabel(snapshot: Pick<StatisticsSnapshot, "schoolYear" | "period">): string {
  return `${snapshot.period}, SY ${snapshot.schoolYear}`;
}
