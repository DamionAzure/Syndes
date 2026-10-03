"use client";

import { BookOpen, Layers, ListChecks, type LucideIcon } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { canTeach } from "@/lib/access/access";
import { resolveAccess } from "@/lib/access/access-bridge";
import { LegacyImport } from "@/features/settings/components/legacy-import";
import { checkDraft } from "../draft-checks";
import {
  createDraft,
  deleteDraft,
  draftContents,
  draftTitle,
  listDrafts,
  newId,
  savedAtLabel,
  startingPart,
} from "../draft-store";
import type { DraftStart } from "../draft-types";
import { authoringRoutes } from "../routes";
import { updateDrafts, useDraftStore } from "../use-drafts";
import { ConfirmDialog } from "./confirm-dialog";

const STARTS: { start: DraftStart; label: string; description: string; icon: LucideIcon }[] = [
  {
    start: "module",
    label: "New module",
    description: "Lessons in order, with a quiz and flashcards if you want them.",
    icon: BookOpen,
  },
  {
    start: "quiz",
    label: "New quiz",
    description: "Questions only. Add a lesson later if it needs one.",
    icon: ListChecks,
  },
  {
    start: "flashcards",
    label: "New flashcard deck",
    description: "Terms and short explanations for review.",
    icon: Layers,
  },
];

export function DraftsView({ headingId }: { headingId: string }) {
  const router = useRouter();
  const drafts = listDrafts(useDraftStore());
  const [starting, setStarting] = useState(false);
  const [accessError, setAccessError] = useState(false);

  async function start(kind: DraftStart) {
    setStarting(true);
    setAccessError(false);
    const access = await resolveAccess(true);
    if (!canTeach(access)) {
      setAccessError(true);
      setStarting(false);
      return;
    }
    const id = newId();
    updateDrafts((store) => createDraft(store, kind, id, new Date().toISOString()));
    router.push(authoringRoutes.editor(id, startingPart({ start: kind })));
    setStarting(false);
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby="start-heading" className="rounded-xl border border-border bg-surface">
        <h2 id="start-heading" className="border-b border-border px-6 py-4 text-section font-semibold">
          Start something new
        </h2>
        <ul className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {STARTS.map(({ start: kind, label, description, icon: Icon }) => (
            <li key={kind} className="grid content-between gap-4 p-6">
              <div className="grid gap-1">
                <Icon aria-hidden="true" className="mb-2 size-6 text-primary" />
                <p className="font-semibold">{label}</p>
                <p className="text-meta text-muted-foreground">{description}</p>
              </div>
              <Button variant="outline" onClick={() => void start(kind)} disabled={starting} className="justify-self-start">
                Create {label.replace(/^New /, "")}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      {accessError ? <p role="alert" className="text-meta text-destructive">Connect to verify Teacher access before starting a new Draft.</p> : null}
      <LegacyImport kind="drafts" />

      <section aria-labelledby="drafts-heading" className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-6 py-4">
          <h2 id="drafts-heading" tabIndex={-1} className="text-section font-semibold">
            Drafts on this device
          </h2>
          <p className="text-meta text-muted-foreground">
            Drafts include correct answers, so they stay with you. Learners only get the sealed module file.
          </p>
        </div>
        {drafts.length === 0 ? (
          <p className="px-6 py-10 text-center text-muted-foreground">
            No drafts yet. Choose what to create above and it will be saved here as you work.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {drafts.map((draft) => {
              const issues = checkDraft(draft).length;
              const title = draftTitle(draft);
              return (
                <li
                  key={draft.id}
                  className="grid gap-4 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{title}</h3>
                      <Badge variant={issues === 0 ? "default" : "outline"}>
                        {issues === 0 ? "Ready to seal" : `${issues} to fix`}
                      </Badge>
                    </div>
                    <p className="mt-1 text-meta text-muted-foreground">
                      {[draft.subject.trim(), draftContents(draft)].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-meta text-muted-foreground">Saved {savedAtLabel(draft.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 md:justify-end">
                    <Link
                      href={authoringRoutes.editor(draft.id)}
                      className={buttonVariants()}
                      aria-label={`Edit ${title}`}
                    >
                      Edit
                    </Link>
                    <ConfirmDialog
                      trigger={<Button variant="outline" aria-label={`Delete ${title}`} />}
                      triggerLabel="Delete"
                      title={`Delete ${title}?`}
                      description="The draft and its answers will be removed from this device. Sealed files you already shared are not affected. This cannot be undone."
                      confirmLabel="Delete draft"
                      onConfirm={() => updateDrafts((store) => deleteDraft(store, draft.id))}
                      focusAfterId={headingId}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
