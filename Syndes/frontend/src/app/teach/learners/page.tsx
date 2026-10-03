import { Users } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { LearnersView } from "@/features/class-records/components/learners-view";

export const metadata: Metadata = { title: "Learners" };

export default function LearnersPage() {
  return (
    <>
      <PageHeader
        icon={Users}
        title="Learners"
        description="Everyone in your sections. Open a learner to see their information, progress and grades."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading your learners…" />}>
        <LearnersView />
      </LocalDataBoundary>
    </>
  );
}
