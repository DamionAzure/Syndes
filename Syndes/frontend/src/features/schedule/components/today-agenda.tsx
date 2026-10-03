"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatTime,
  nextSchoolDay,
  SESSION_KIND_LABEL,
  sessionsOn,
  sessionStates,
  WEEKDAY_NAME,
  weekdayOf,
  type SessionState,
} from "../schedule";
import { useSchedule } from "../schedule-source";
import type { ScheduleSession } from "../schedule-types";
import { useNow } from "../use-now";

const STATE_LABEL: Record<SessionState, string | null> = { done: "Done", now: "Now", next: "Next", later: null };

export const SCHEDULE_ROUTE = "/teach/schedule";

/**
 * The Teacher's day as a timeline: time on the left, the period beside it,
 * and Now and Next said in words. On a day without classes it shows the
 * next school day instead.
 */
export function TodayAgenda() {
  const sessions = useSchedule();
  const now = useNow();
  const today = sessionsOn(sessions, weekdayOf(now));
  const fallbackDay = today.length === 0 ? nextSchoolDay(sessions, now) : null;
  const shown = today.length > 0 ? today : fallbackDay ? sessionsOn(sessions, fallbackDay) : [];
  const states = today.length > 0 ? sessionStates(today, now) : new Map<string, SessionState>();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <section aria-labelledby="today-heading" className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 id="today-heading" className="text-section font-semibold">
            {today.length > 0 ? "Today" : "No classes today"}
          </h2>
          <p className="text-meta text-muted-foreground">
            {today.length > 0
              ? dateLabel
              : fallbackDay
                ? `${dateLabel}. Next up is ${WEEKDAY_NAME[fallbackDay]}.`
                : `${dateLabel}. Your schedule is empty.`}
          </p>
        </div>
        <Link href={SCHEDULE_ROUTE} className={buttonVariants({ variant: "outline", size: "sm" })}>
          See the week
        </Link>
      </div>
      {shown.length > 0 ? (
        <ol className="px-6 py-4">
          {shown.map((session) => (
            <AgendaRow key={session.id} session={session} state={states.get(session.id) ?? null} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function AgendaRow({ session, state }: { session: ScheduleSession; state: SessionState | null }) {
  const label = state ? STATE_LABEL[state] : null;
  const active = state === "now";
  return (
    <li
      aria-current={active ? "time" : undefined}
      className={cn(
        "relative grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 border-l-2 border-border py-3 pl-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]",
        active && "border-primary",
        state === "done" && "text-muted-foreground",
      )}
    >
      <span className="text-meta tabular-nums">
        <span className="block font-medium text-foreground">{formatTime(session.start)}</span>
        <span className="block text-muted-foreground">to {formatTime(session.end)}</span>
      </span>
      <span className="min-w-0">
        <span className={cn("block font-semibold", state === "done" && "font-medium")}>
          {session.title}
          {session.kind !== "class" ? (
            <span className="font-normal text-muted-foreground">, {SESSION_KIND_LABEL[session.kind].toLowerCase()}</span>
          ) : null}
        </span>
        <span className="block text-meta text-muted-foreground">
          {session.group}, {session.room}
        </span>
      </span>
      {label ? (
        <span
          className={cn(
            "col-start-2 justify-self-start rounded-md border px-2 py-0.5 text-meta font-medium sm:col-start-3 sm:self-center",
            active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
          )}
        >
          {label}
        </span>
      ) : null}
    </li>
  );
}
