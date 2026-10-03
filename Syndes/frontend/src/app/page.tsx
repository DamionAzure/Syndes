import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { HomeView } from "@/features/home/components/home-view";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading your modules…" />}>
      <HomeView />
    </LocalDataBoundary>
  );
}
