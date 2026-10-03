"use client";

import { FilePenLine } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { FolioLayout } from "@/components/layout/folio-layout";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { standaloneLink } from "@/lib/link-styles";
import { cn } from "@/lib/utils";
import { checkDraft, type DraftIssue } from "../draft-checks";
import { draftTitle, newLesson, parsePart, partKey } from "../draft-store";
import type { DraftPart, ModuleDraft } from "../draft-types";
import { authoringRoutes } from "../routes";
import { editDraft, useDraftStore } from "../use-drafts";
import { DetailsEditor } from "./details-editor";
import { DraftOutline } from "./draft-outline";
import { FlashcardsEditor } from "./flashcards-editor";
import type { EditDraft } from "./item-controls";
import { LessonEditor } from "./lesson-editor";
import { QuizEditor } from "./quiz-editor";
import { SealPanel } from "./seal-panel";

const PAGE_HEADING_ID = "editor-heading";
const PART_HEADING_ID = "part-heading";

function partHeading(part: DraftPart, draft: ModuleDraft): { title: string; description: string } {
  switch (part.kind) {
    case "details":
      return { title: "Details", description: "What Learners see before they start." };
    case "lesson":
      return {
        title: `Lesson ${part.lesson} of ${draft.lessons.length}`,
        description: "One reading step. Keep it short enough to finish in one sitting.",
      };
    case "quiz":
      return { title: "Quiz", description: "Checked on the Learner's device, with or without a connection." };
    case "flashcards":
      return { title: "Flashcards", description: "A deck Learners can review at any time." };
  }
}

function focusField(id: string) {
  const field = document.getElementById(id) ?? document.getElementById(PART_HEADING_ID);
  field?.focus();
  field?.scrollIntoView({ block: "center" });
}

export function DraftEditorView() {
  const searchParams = useSearchParams();
  const store = useDraftStore();
  const draft = store.drafts[searchParams.get("draft") ?? ""];

  if (!draft) {
    return (
      <>
        <PageHeader id={PAGE_HEADING_ID} icon={FilePenLine} title="Draft not found" />
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="max-w-[52ch] text-muted-foreground">
            This draft is not saved on this device. It may have been deleted, or created on another device.
          </p>
          <Link href={authoringRoutes.drafts()} className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            Go to drafts
          </Link>
        </div>
      </>
    );
  }

  return <DraftEditor key={draft.id} draft={draft} part={parsePart(searchParams.get("part"), draft)} />;
}

function DraftEditor({ draft, part }: { draft: ModuleDraft; part: DraftPart }) {
  const router = useRouter();
  const issues = checkDraft(draft);
  const heading = partHeading(part, draft);
  const currentKey = partKey(part);
  // The field an issue named, to focus once its part has rendered.
  const pendingFocus = useRef<string | null>(null);
  const previousKey = useRef(currentKey);

  const edit: EditDraft = (change) => editDraft(draft.id, change);

  // A new part is a new view: move focus to its heading, or to the field an issue named.
  useEffect(() => {
    if (previousKey.current === currentKey) return;
    previousKey.current = currentKey;
    const target = pendingFocus.current ?? PART_HEADING_ID;
    pendingFocus.current = null;
    focusField(target);
  }, [currentKey]);

  function go(next: DraftPart) {
    router.push(authoringRoutes.editor(draft.id, next), { scroll: false });
  }

  function showIssue(issue: DraftIssue) {
    const target = issue.fieldId ?? PART_HEADING_ID;
    if (partKey(issue.part) === currentKey) {
      focusField(target);
    } else {
      pendingFocus.current = target;
      go(issue.part);
    }
  }

  function addLesson() {
    const lesson = newLesson();
    edit((current) => ({ ...current, lessons: [...current.lessons, lesson] }));
    go({ kind: "lesson", lesson: draft.lessons.length + 1 });
  }

  return (
    <>
      <PageHeader
        id={PAGE_HEADING_ID}
        icon={FilePenLine}
        title={draftTitle(draft)}
        description="Changes are saved on this device as you type."
        context={
          <Link href={authoringRoutes.drafts()} className={cn(standaloneLink, "text-meta")}>
            All drafts
          </Link>
        }
      />
      <FolioLayout
        railLabel="Draft outline"
        marginLabel="Sealing checks"
        rail={<DraftOutline draft={draft} current={part} issues={issues} onAddLesson={addLesson} />}
        margin={<SealPanel draft={draft} issues={issues} onShowIssue={showIssue} />}
      >
        <div className="mb-8 border-b border-border pb-5">
          <h2 id={PART_HEADING_ID} tabIndex={-1} className="text-section font-semibold outline-none">
            {heading.title}
          </h2>
          <p className="mt-1 text-muted-foreground">{heading.description}</p>
        </div>
        {part.kind === "details" ? <DetailsEditor draft={draft} edit={edit} /> : null}
        {part.kind === "lesson" ? (
          <LessonEditor
            key={part.lesson}
            draft={draft}
            lessonNumber={part.lesson}
            edit={edit}
            focusAfterRemoveId={PART_HEADING_ID}
            onRemoved={() =>
              go(part.lesson > 1 ? { kind: "lesson", lesson: part.lesson - 1 } : { kind: "details" })
            }
          />
        ) : null}
        {part.kind === "quiz" ? <QuizEditor draft={draft} edit={edit} headingId={PART_HEADING_ID} /> : null}
        {part.kind === "flashcards" ? (
          <FlashcardsEditor draft={draft} edit={edit} headingId={PART_HEADING_ID} />
        ) : null}
      </FolioLayout>
    </>
  );
}
