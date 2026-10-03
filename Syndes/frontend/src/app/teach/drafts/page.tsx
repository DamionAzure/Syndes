import { FilePenLine } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { DraftsView } from "@/features/authoring/components/drafts-view";

export const metadata: Metadata = { title: "Editor" };

const HEADING_ID = "drafts-page-heading";

export default function DraftsPage() {
  return (
    <>
      <PageHeader
        id={HEADING_ID}
        icon={FilePenLine}
        title="Editor"
        description="Write modules, quizzes and flashcard decks, then seal them into files Learners can open offline."
      />
      <LocalDataBoundary fallback={<LoadingState label="Loading your drafts…" />}>
        <DraftsView headingId={HEADING_ID} />
      </LocalDataBoundary>
    </>
  );
}
