import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PersonView } from "@/features/school-directory/components/person-view";

export const metadata: Metadata = { title: "Person" };

export default function PersonPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading this account…" />}>
      <PersonView />
    </LocalDataBoundary>
  );
}
