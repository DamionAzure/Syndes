import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { QuizListView } from "@/features/quiz/components/quiz-list-view";

export const metadata: Metadata = { title: "Quizzes" };

export default function QuizzesPage() {
  return (
    <>
      <PageHeader
        icon={ListChecks}
        title="Quizzes"
        description="Short quizzes at the end of each module, scored on this device."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading quizzes…" />}>
        <QuizListView />
      </LocalDataBoundary>
    </>
  );
}
