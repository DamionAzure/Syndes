import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { LearnerProfileView } from "@/features/class-records/components/learner-profile-view";

export const metadata: Metadata = { title: "Learner" };

export default function LearnerPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading the learner…" />}>
      <LearnerProfileView />
    </LocalDataBoundary>
  );
}
