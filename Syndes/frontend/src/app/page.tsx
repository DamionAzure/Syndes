import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { HomeView } from "@/features/home/components/home-view";

// The layout's title template only applies to child segments, so Home sets it in full.
export const metadata: Metadata = { title: { absolute: "Home · Syndes" } };

export default function HomePage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading your modules…" />}>
      <HomeView />
    </LocalDataBoundary>
  );
}
