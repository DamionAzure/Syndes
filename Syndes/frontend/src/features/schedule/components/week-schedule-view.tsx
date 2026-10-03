"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatTime,
  periodsOf,
  SCHOOL_DAYS,
  SESSION_KIND_LABEL,
  sessionsOn,
  timeRange,
  WEEKDAY_NAME,
  weekdayOf,
} from "../schedule";
import { useSchedule } from "../schedule-source";
import type { ScheduleSession } from "../schedule-types";
import { useNow } from "../use-now";

function SessionText({ session }: { session: ScheduleSession }) {
  return (
    <span className="grid gap-0.5">
      <span className="text-body font-semibold">{session.title}</span>
      <span className="text-muted-foreground">{session.group}</span>
      <span className="text-muted-foreground">
        {session.room}
        {session.kind !== "class" ? `, ${SESSION_KIND_LABEL[session.kind].toLowerCase()}` : ""}
      </span>
    </span>
  );
}

/** Periods down the side, school days across, with today's column marked in words. */
export function WeekScheduleView() {
  const sessions = useSchedule();
  const today = weekdayOf(useNow());
  const periods = periodsOf(sessions);

  if (sessions.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
        <h2 className="text-section font-semibold">No schedule yet</h2>
        <p className="text-muted-foreground">Your classes appear here once your school&apos;s schedule is added.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
        <Table label="Weekly schedule">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-36">
                Period
              </TableHead>
              {SCHOOL_DAYS.map((day) => (
                <TableHead key={day} scope="col" className={cn(day === today && "text-foreground")}>
                  {WEEKDAY_NAME[day]}
                  {day === today ? <span className="font-normal text-primary">, today</span> : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((period) => (
              <TableRow key={`${period.start}-${period.end}`}>
                <TableHead scope="row" className="align-top font-normal">
                  <span className="block font-medium text-foreground">{formatTime(period.start)}</span>
                  <span className="block">to {formatTime(period.end)}</span>
                </TableHead>
                {SCHOOL_DAYS.map((day) => {
                  const session = sessions.find(
                    (candidate) => candidate.day === day && candidate.start === period.start && candidate.end === period.end,
                  );
                  return (
                    <TableCell
                      key={day}
                      className={cn("align-top", day === today && "bg-surface-muted/60")}
                    >
                      {session ? <SessionText session={session} /> : <span className="sr-only">Free</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 md:hidden">
        {SCHOOL_DAYS.map((day) => {
          const daySessions = sessionsOn(sessions, day);
          return (
            <section
              key={day}
              aria-labelledby={`day-${day}`}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <h2 id={`day-${day}`} className="border-b border-border px-5 py-3 font-semibold">
                {WEEKDAY_NAME[day]}
                {day === today ? <span className="font-normal text-primary">, today</span> : null}
              </h2>
              {daySessions.length === 0 ? (
                <p className="px-5 py-4 text-muted-foreground">No classes</p>
              ) : (
                <ul className="divide-y divide-border">
                  {daySessions.map((session) => (
                    <li key={session.id} className="grid gap-1 px-5 py-3 text-meta">
                      <span className="tabular-nums text-muted-foreground">{timeRange(session)}</span>
                      <SessionText session={session} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
