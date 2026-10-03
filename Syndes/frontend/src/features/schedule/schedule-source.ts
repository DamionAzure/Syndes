import { use } from "react";
import type { ScheduleSession, Weekday } from "./schedule-types";

/**
 * SAMPLE DATA ONLY (ADR-0005): a Grade 6 Science teacher's week. The
 * school's real schedule replaces this through the source below.
 */
function week(
  days: readonly Weekday[],
  session: Omit<ScheduleSession, "id" | "day">,
): ScheduleSession[] {
  return days.map((day) => ({ ...session, day, id: `${session.title}-${session.group}-${day}-${session.start}` }));
}

const MON_TO_FRI: readonly Weekday[] = [1, 2, 3, 4, 5];

const SAMPLE_SESSIONS: ScheduleSession[] = [
  ...week(MON_TO_FRI, { start: "07:30", end: "07:45", kind: "advisory", title: "Homeroom", group: "Grade 6 Sampaguita", room: "Room 6-A" }),
  ...week(MON_TO_FRI, { start: "07:45", end: "08:45", kind: "class", title: "Science", group: "Grade 6 Sampaguita", room: "Room 6-A" }),
  ...week([1, 3, 5], { start: "09:00", end: "10:00", kind: "class", title: "English", group: "Grade 6 Sampaguita", room: "Room 6-A" }),
  ...week(MON_TO_FRI, { start: "10:15", end: "11:15", kind: "class", title: "Science", group: "Grade 6 Narra", room: "Science lab" }),
  ...week([2, 4], { start: "13:00", end: "14:00", kind: "consultation", title: "Learner consultation", group: "By appointment", room: "Faculty room" }),
];

export interface ScheduleSource {
  listSessions(): Promise<ScheduleSession[]>;
}

const sampleSource: ScheduleSource = { listSessions: async () => SAMPLE_SESSIONS };

const activeSource: ScheduleSource = sampleSource;

let pending: Promise<ScheduleSession[]> | null = null;

/** Suspends until the schedule is read. Use inside LocalDataBoundary. */
export function useSchedule(): ScheduleSession[] {
  pending ??= activeSource.listSessions();
  return use(pending);
}
