import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { GradesView } from "@/features/class-records/components/grades-view";

export const metadata: Metadata = { title: "Grades" };

export default function GradesPage() {
  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="Grades"
        description="Your class record for each quarter: written work, performance tasks and the quarterly assessment."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading the class record…" />}>
        <GradesView />
      </LocalDataBoundary>
    </>
  );
}
