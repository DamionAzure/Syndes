import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { SchoolOverview } from "./_components/school-overview";

export const metadata: Metadata = { title: "School" };

export default function AdminPage() {
  return (
    <>
      <PageHeader
        icon={Landmark}
        title="School"
        description="Enrollment, passing, failing and drop rates for each grading period, and what needs your attention."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading school statistics…" />}>
        <SchoolOverview />
      </LocalDataBoundary>
    </>
  );
}
