import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { WeekScheduleView } from "@/features/schedule/components/week-schedule-view";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="Schedule"
        description="Your classes, advisory and consultation hours for the week."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading your schedule…" />}>
        <WeekScheduleView />
      </LocalDataBoundary>
    </>
  );
}
