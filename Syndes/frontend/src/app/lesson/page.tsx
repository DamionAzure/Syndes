import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { LessonView } from "@/features/lessons/components/lesson-view";

export const metadata: Metadata = { title: "Lesson" };

export default function LessonPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading the lesson…" />}>
      <LessonView />
    </LocalDataBoundary>
  );
}
