import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { QuizView } from "@/features/quiz/components/quiz-view";

export const metadata: Metadata = { title: "Short quiz" };

export default function QuizPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading the quiz…" />}>
      <QuizView />
    </LocalDataBoundary>
  );
}
