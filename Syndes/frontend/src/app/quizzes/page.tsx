import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { QuizListView } from "@/features/quiz/components/quiz-list-view";

export const metadata: Metadata = { title: "Quizzes" };

export default function QuizzesPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading quizzes…" />}>
      <QuizListView />
    </LocalDataBoundary>
  );
}
