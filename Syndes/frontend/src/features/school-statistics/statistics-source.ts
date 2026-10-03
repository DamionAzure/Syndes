import { use } from "react";
import type { SectionStatistics, StatisticsSnapshot } from "./statistics-types";

/**
 * SAMPLE DATA ONLY (ADR-0007). Counts for a small fictional school, matching
 * the sample Directory. Real snapshots are taken by the admin-only
 * `capture_school_statistics()` function (migration 0004).
 */
function section(
  sectionId: string,
  label: string,
  counts: Omit<SectionStatistics, "sectionId" | "label">,
): SectionStatistics {
  return { sectionId, label, ...counts };
}

const LAST_YEAR = "2025–2026";
const THIS_YEAR = "2026–2027";

function lastYear(period: string, capturedAt: string, passing: number, failing: number, dropped: number): StatisticsSnapshot {
  const enrolledAtStart = 49;
  return {
    id: `${LAST_YEAR}-${period}`,
    capturedAt,
    schoolYear: LAST_YEAR,
    period,
    enrolledAtStart,
    enrolled: enrolledAtStart - dropped - (period === "Quarter 4" ? 1 : 0),
    assessed: passing + failing,
    passing,
    failing,
    dropped,
    sections: [],
  };
}

const SAMPLE_SNAPSHOTS: StatisticsSnapshot[] = [
  lastYear("Quarter 1", "2025-08-29T17:00:00+08:00", 42, 7, 0),
  lastYear("Quarter 2", "2025-11-07T17:00:00+08:00", 43, 5, 1),
  lastYear("Quarter 3", "2026-01-30T17:00:00+08:00", 43, 4, 2),
  lastYear("Quarter 4", "2026-04-10T17:00:00+08:00", 44, 2, 2),
  {
    id: `${THIS_YEAR}-Quarter 1`,
    capturedAt: "2026-08-29T17:00:00+08:00",
    schoolYear: THIS_YEAR,
    period: "Quarter 1",
    enrolledAtStart: 51,
    enrolled: 50,
    assessed: 50,
    passing: 45,
    failing: 5,
    dropped: 1,
    sections: [
      section("g4-mabini", "Grade 4 Mabini", { enrolled: 8, assessed: 8, passing: 8, failing: 0, dropped: 0 }),
      section("g4-rizal", "Grade 4 Rizal", { enrolled: 9, assessed: 9, passing: 8, failing: 1, dropped: 0 }),
      section("g5-bonifacio", "Grade 5 Bonifacio", { enrolled: 8, assessed: 8, passing: 7, failing: 1, dropped: 0 }),
      section("g5-luna", "Grade 5 Luna", { enrolled: 8, assessed: 8, passing: 7, failing: 1, dropped: 1 }),
      section("g6-narra", "Grade 6 Narra", { enrolled: 9, assessed: 9, passing: 8, failing: 1, dropped: 0 }),
      section("g6-sampaguita", "Grade 6 Sampaguita", { enrolled: 8, assessed: 8, passing: 7, failing: 1, dropped: 0 }),
    ],
  },
];

export interface StatisticsSource {
  listSnapshots(): Promise<StatisticsSnapshot[]>;
}

const sampleSource: StatisticsSource = { listSnapshots: async () => SAMPLE_SNAPSHOTS };

const activeSource: StatisticsSource = sampleSource;

let pending: Promise<StatisticsSnapshot[]> | null = null;

/** Suspends until the snapshots are read. Use inside LocalDataBoundary. */
export function useStatisticsSnapshots(): StatisticsSnapshot[] {
  pending ??= activeSource.listSnapshots();
  return use(pending);
}
