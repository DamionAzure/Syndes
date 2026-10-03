import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressView } from "@/features/progress/components/progress-view";

export const metadata: Metadata = { title: "Progress" };

const HEADING_ID = "progress-heading";

export default function ProgressPage() {
  return (
    <>
      <PageHeader
        id={HEADING_ID}
        icon={Bookmark}
        title="Progress"
        description="Your saved place in each module. Progress is saved on this device only."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading your progress…" />}>
        <ProgressView headingId={HEADING_ID} />
      </LocalDataBoundary>
    </>
  );
}
