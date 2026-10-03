import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { FlashcardsView } from "@/features/flashcards/components/flashcards-view";

export const metadata: Metadata = { title: "Flashcards" };

export default function FlashcardsPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading flashcards…" />}>
      <FlashcardsView />
    </LocalDataBoundary>
  );
}
