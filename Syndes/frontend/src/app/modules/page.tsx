import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { LibraryView } from "@/features/modules/components/library-view";

export const metadata: Metadata = { title: "Modules" };

export default function ModulesPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading the library…" />}>
      <LibraryView />
    </LocalDataBoundary>
  );
}
