import { LayoutGrid } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { SectionsView } from "@/features/school-directory/components/sections-view";

export const metadata: Metadata = { title: "Sections" };

export default function SectionsPage() {
  return (
    <>
      <PageHeader
        id="sections-page-heading"
        icon={LayoutGrid}
        title="Sections"
        description="Each section's classes and who teaches them. Create sections, add learning areas and assign teachers."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading sections…" />}>
        <SectionsView />
      </LocalDataBoundary>
    </>
  );
}
