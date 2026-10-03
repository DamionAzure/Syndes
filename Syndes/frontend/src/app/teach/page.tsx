import { School } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { TeachOverview } from "./_components/teach-overview";

export const metadata: Metadata = { title: "Teaching" };

export default function TeachPage() {
  return (
    <>
      <PageHeader
        icon={School}
        title="Teaching"
        description="Your day, the learners who need a look, and the modules you are still writing."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading your classes…" />}>
        <TeachOverview />
      </LocalDataBoundary>
    </>
  );
}
