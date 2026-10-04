import { History } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityView } from "@/features/school-directory/components/activity-view";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        icon={History}
        title="Activity"
        description="Every change to access, sections and classes, with when it happened and who made it."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading activity…" />}>
        <ActivityView />
      </LocalDataBoundary>
    </>
  );
}
