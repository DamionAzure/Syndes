import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { ProgressView } from "@/features/progress/components/progress-view";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading your progress…" />}>
      <ProgressView />
    </LocalDataBoundary>
  );
}
