import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { HomeView } from "@/features/home/components/home-view";

// The layout's title template only applies to child segments, so Home sets it in full.
export const metadata: Metadata = { title: { absolute: "Home · Syndes" } };

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[56rem]">
      <PageHeader title="Home">
        Pick up where you left off, or open a module. Everything here works without a connection.
      </PageHeader>
      <LocalDataBoundary fallback={<LoadingState label="Loading your modules…" />}>
        <HomeView />
      </LocalDataBoundary>
    </div>
  );
}
