"use client";

import { FileText, Layers, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftIssue } from "../draft-checks";
import { draftTitle, partKey, savedAtLabel } from "../draft-store";
import type { DraftPart, ModuleDraft } from "../draft-types";
import { authoringRoutes } from "../routes";

type OutlineEntry = { part: DraftPart; label: string; detail: string };

function issueCount(issues: readonly DraftIssue[], part: DraftPart): number {
  const key = partKey(part);
  return issues.filter((issue) => partKey(issue.part) === key).length;
}

/**
 * The draft as a Learner will meet it: details, Lessons in order, then the
 * Quiz and Flashcards. The same rail shape Learners see, so the Teacher
 * builds the sequence they are shaping.
 */
export function DraftOutline({
  draft,
  current,
  issues,
  onAddLesson,
}: {
  draft: ModuleDraft;
  current: DraftPart;
  issues: readonly DraftIssue[];
  onAddLesson: () => void;
}) {
  const currentKey = partKey(current);
  const entries: OutlineEntry[] = [
    { part: { kind: "details" }, label: "Details", detail: "Title, subject, outcomes" },
    ...draft.lessons.map((lesson, index) => ({
      part: { kind: "lesson", lesson: index + 1 } as const,
      label: lesson.title.trim() || "Untitled lesson",
      detail: `Lesson ${index + 1}, ${lesson.minutes} min`,
    })),
  ];
  const after: OutlineEntry[] = [
    {
      part: { kind: "quiz" },
      label: "Quiz",
      detail: draft.questions.length ? `${draft.questions.length} ${draft.questions.length === 1 ? "question" : "questions"}` : "No questions yet",
    },
    {
      part: { kind: "flashcards" },
      label: "Flashcards",
      detail: draft.flashcards.length ? `${draft.flashcards.length} ${draft.flashcards.length === 1 ? "flashcard" : "flashcards"}` : "No flashcards yet",
    },
  ];

  function renderEntry(entry: OutlineEntry, marker: ReactNode) {
    const key = partKey(entry.part);
    const isCurrent = key === currentKey;
    const toFix = issueCount(issues, entry.part);
    return (
      <li key={key}>
        <Link
          href={authoringRoutes.editor(draft.id, entry.part)}
          aria-current={isCurrent ? "step" : undefined}
          className={cn(
            "grid min-h-(--control-height) grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-meta text-muted-foreground hover:bg-surface hover:text-foreground",
            isCurrent && "bg-surface text-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid size-7 place-content-center rounded-md border border-border tabular-nums",
              isCurrent && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {marker}
          </span>
          <span className="min-w-0">
            <span className={cn("block truncate", isCurrent && "font-semibold")}>{entry.label}</span>
            <span className="block text-muted-foreground">
              {entry.detail}
              {toFix > 0 ? <span className="text-destructive">, {toFix} to fix</span> : null}
            </span>
          </span>
        </Link>
      </li>
    );
  }

  return (
    <nav aria-label="Draft outline" className="grid gap-5">
      <div>
        <p className="font-semibold">{draftTitle(draft)}</p>
        <p className="text-meta text-muted-foreground">Saved on this device {savedAtLabel(draft.updatedAt)}</p>
      </div>
      <ol className="grid gap-1">
        {entries.map((entry, index) =>
          renderEntry(entry, index === 0 ? <FileText className="size-4" /> : String(index)),
        )}
      </ol>
      <Button variant="ghost" size="sm" onClick={onAddLesson} className="justify-self-start">
        <Plus aria-hidden="true" data-icon="inline-start" />
        Add lesson
      </Button>
      <ol className="grid gap-1 border-t border-border pt-4" aria-label="After the lessons">
        {after.map((entry) =>
          renderEntry(
            entry,
            entry.part.kind === "quiz" ? <ListChecks className="size-4" /> : <Layers className="size-4" />,
          ),
        )}
      </ol>
    </nav>
  );
}
