import { LibraryBig } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { LibraryView } from "@/features/modules/components/library-view";

export const metadata: Metadata = { title: "Modules" };

export default function ModulesPage() {
  return (
    <>
      <PageHeader
        icon={LibraryBig}
        title="Modules"
        description="Every module stored on this device, plus any your class has listed."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading the library…" />}>
        <LibraryView />
      </LocalDataBoundary>
    </>
  );
}
