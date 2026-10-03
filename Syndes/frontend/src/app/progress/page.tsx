import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressView } from "@/features/progress/components/progress-view";

const HEADING_ID = "progress-heading";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-[56rem]">
      <PageHeader id={HEADING_ID} title="Progress">
        Progress is saved on this device only.
      </PageHeader>
      <LocalDataBoundary fallback={<LoadingState label="Loading your progress…" />}>
        <ProgressView headingId={HEADING_ID} />
      </LocalDataBoundary>
    </div>
  );
}
