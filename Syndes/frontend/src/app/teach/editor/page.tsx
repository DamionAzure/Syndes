import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { DraftEditorView } from "@/features/authoring/components/draft-editor-view";

export const metadata: Metadata = { title: "Edit draft" };

export default function EditorPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Opening the draft…" />}>
      <DraftEditorView />
    </LocalDataBoundary>
  );
}
