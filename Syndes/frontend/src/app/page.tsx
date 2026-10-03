import { House } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { HomeView } from "@/features/home/components/home-view";

// The layout's title template only applies to child segments, so Home sets it in full.
export const metadata: Metadata = { title: { absolute: "Home · Syndes" } };

export default function HomePage() {
  return (
    <>
      <PageHeader
        icon={House}
        title="Home"
        description="Pick up where you left off, or open a module. Everything here works without a connection."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading your modules…" />}>
        <HomeView />
      </LocalDataBoundary>
    </>
  );
}
