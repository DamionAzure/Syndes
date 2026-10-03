import type { ScheduleSession, SessionKind, Weekday } from "./schedule-types";

export const SCHOOL_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5];

export const WEEKDAY_NAME: Record<Weekday, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  class: "Class",
  advisory: "Advisory",
  consultation: "Consultation",
};

export function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "13:05" → "1:05 PM". Fixed format so it reads the same on every device. */
export function formatTime(time: string): string {
  const total = minutesOf(time);
  const hours = Math.floor(total / 60);
  const minutes = String(total % 60).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${minutes} ${suffix}`;
}

export function timeRange(session: Pick<ScheduleSession, "start" | "end">): string {
  return `${formatTime(session.start)} to ${formatTime(session.end)}`;
}

export function weekdayOf(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

export function sessionsOn(sessions: readonly ScheduleSession[], day: Weekday): ScheduleSession[] {
  return sessions
    .filter((session) => session.day === day)
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

export type SessionState = "done" | "now" | "next" | "later";

/** Where each of today's sessions stands at `now`; only one session is ever "next". */
export function sessionStates(
  today: readonly ScheduleSession[],
  now: Date,
): Map<string, SessionState> {
  const current = now.getHours() * 60 + now.getMinutes();
  const states = new Map<string, SessionState>();
  let nextAssigned = false;
  for (const session of today) {
    const start = minutesOf(session.start);
    const end = minutesOf(session.end);
    if (current >= end) states.set(session.id, "done");
    else if (current >= start) states.set(session.id, "now");
    else if (!nextAssigned) {
      states.set(session.id, "next");
      nextAssigned = true;
    } else states.set(session.id, "later");
  }
  return states;
}

/** The next school day after `now` that has sessions, or null for an empty schedule. */
export function nextSchoolDay(
  sessions: readonly ScheduleSession[],
  now: Date,
): Weekday | null {
  const today = weekdayOf(now);
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = (((today - 1 + offset) % 7) + 1) as Weekday;
    if (sessions.some((session) => session.day === day)) return day;
  }
  return null;
}

/** Distinct period start/end pairs across the week, in order, for the weekly grid. */
export function periodsOf(sessions: readonly ScheduleSession[]): { start: string; end: string }[] {
  const seen = new Map<string, { start: string; end: string }>();
  for (const session of sessions) seen.set(`${session.start}-${session.end}`, { start: session.start, end: session.end });
  return [...seen.values()].sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}
