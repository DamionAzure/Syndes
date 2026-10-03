"use client";

import { Heading, Pilcrow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldIds } from "../draft-checks";
import { move, newBlock, removeAt, replaceAt } from "../draft-store";
import type { DraftBlock, DraftLesson, ModuleDraft } from "../draft-types";
import { ItemControls, wholeNumber, type EditDraft } from "./item-controls";

const BLOCK_LABEL: Record<DraftBlock["kind"], string> = { heading: "Heading", paragraph: "Paragraph" };

export function LessonEditor({
  draft,
  lessonNumber,
  edit,
  onRemoved,
  focusAfterRemoveId,
}: {
  draft: ModuleDraft;
  lessonNumber: number;
  edit: EditDraft;
  onRemoved: () => void;
  focusAfterRemoveId: string;
}) {
  const index = lessonNumber - 1;
  const lesson = draft.lessons[index];
  if (!lesson) return null;

  function editLesson(change: (current: DraftLesson) => DraftLesson) {
    edit((current) => {
      const target = current.lessons[index];
      return target ? { ...current, lessons: replaceAt(current.lessons, index, change(target)) } : current;
    });
  }

  function editBlocks(change: (blocks: DraftBlock[]) => DraftBlock[]) {
    editLesson((current) => ({ ...current, blocks: change(current.blocks) }));
  }

  function addBlock(kind: DraftBlock["kind"]) {
    const block = newBlock(kind);
    editBlocks((blocks) => [...blocks, block]);
    window.setTimeout(() => document.getElementById(fieldIds.block(block.id))?.focus(), 0);
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <Field>
          <FieldLabel htmlFor={fieldIds.lessonTitle(lesson.id)}>Lesson title</FieldLabel>
          <Input
            id={fieldIds.lessonTitle(lesson.id)}
            value={lesson.title}
            onChange={(event) => editLesson((current) => ({ ...current, title: event.target.value }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`lesson-${lesson.id}-minutes`}>Minutes</FieldLabel>
          <Input
            id={`lesson-${lesson.id}-minutes`}
            type="number"
            inputMode="numeric"
            min={0}
            value={lesson.minutes}
            onChange={(event) =>
              editLesson((current) => ({ ...current, minutes: wholeNumber(event.target.value, current.minutes) }))
            }
          />
        </Field>
      </div>

      <section aria-labelledby="lesson-content-heading" className="grid gap-4">
        <div>
          <h3 id="lesson-content-heading" className="font-semibold">Lesson content</h3>
          <p className="text-meta text-muted-foreground">
            Learners read these in order. Use headings to break the lesson into short sections.
          </p>
        </div>
        <ol className="grid gap-4">
          {lesson.blocks.map((block, blockIndex) => {
            const label = `${BLOCK_LABEL[block.kind]} ${blockIndex + 1}`;
            const id = fieldIds.block(block.id);
            return (
              <li key={block.id} className="grid gap-2 border-l-2 border-border pl-4 focus-within:border-primary">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={id} className="text-meta font-medium">
                    {label}
                  </label>
                  <ItemControls
                    itemLabel={label.toLowerCase()}
                    index={blockIndex}
                    total={lesson.blocks.length}
                    onMove={(delta) => editBlocks((blocks) => move(blocks, blockIndex, delta))}
                    onRemove={() => editBlocks((blocks) => removeAt(blocks, blockIndex))}
                  />
                </div>
                {block.kind === "heading" ? (
                  <Input
                    id={id}
                    value={block.text}
                    className="font-semibold"
                    onChange={(event) =>
                      editBlocks((blocks) => replaceAt(blocks, blockIndex, { ...block, text: event.target.value }))
                    }
                  />
                ) : (
                  <Textarea
                    id={id}
                    value={block.text}
                    className="leading-[1.7]"
                    onChange={(event) =>
                      editBlocks((blocks) => replaceAt(blocks, blockIndex, { ...block, text: event.target.value }))
                    }
                  />
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("heading")}>
            <Heading aria-hidden="true" data-icon="inline-start" />
            Add heading
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("paragraph")}>
            <Pilcrow aria-hidden="true" data-icon="inline-start" />
            Add paragraph
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-meta text-muted-foreground">
          Lesson {lessonNumber} of {draft.lessons.length}
        </p>
        <ConfirmDialog
          trigger={<Button variant="destructive" />}
          triggerLabel="Remove lesson"
          title={`Remove lesson ${lessonNumber}?`}
          description={`"${lesson.title.trim() || "Untitled lesson"}" and everything in it will be removed from this draft. This cannot be undone.`}
          confirmLabel="Remove lesson"
          onConfirm={() => {
            edit((current) => ({ ...current, lessons: removeAt(current.lessons, index) }));
            onRemoved();
          }}
          focusAfterId={focusAfterRemoveId}
        />
      </div>
    </div>
  );
}
