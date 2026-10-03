import { ChartColumn } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { ScoresView } from "@/features/class-records/components/scores-view";

export const metadata: Metadata = { title: "Scores" };

export default function ScoresPage() {
  return (
    <>
      <PageHeader
        icon={ChartColumn}
        title="Scores"
        description="Quiz results and progress in each module, learner by learner."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading scores…" />}>
        <ScoresView />
      </LocalDataBoundary>
    </>
  );
}
