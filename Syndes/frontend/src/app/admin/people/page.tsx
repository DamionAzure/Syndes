import { UserCog } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { PeopleView } from "@/features/school-directory/components/people-view";

export const metadata: Metadata = { title: "People and access" };

export default function PeoplePage() {
  return (
    <>
      <PageHeader
        icon={UserCog}
        title="People and access"
        description="Everyone with an account. Open a person to give or remove access and place them in a section or class."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading the school directory…" />}>
        <PeopleView />
      </LocalDataBoundary>
    </>
  );
}
