import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { ResultView } from "@/features/quiz/components/result-view";

export const metadata: Metadata = { title: "Quiz result" };

export default function QuizResultPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Scoring on this device…" />}>
      <ResultView />
    </LocalDataBoundary>
  );
}
