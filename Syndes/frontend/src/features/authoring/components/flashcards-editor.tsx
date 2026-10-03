"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldIds } from "../draft-checks";
import { move, newFlashcard, removeAt, replaceAt } from "../draft-store";
import type { DraftFlashcard, ModuleDraft } from "../draft-types";
import { ItemControls, type EditDraft } from "./item-controls";

export function FlashcardsEditor({
  draft,
  edit,
  headingId,
}: {
  draft: ModuleDraft;
  edit: EditDraft;
  headingId: string;
}) {
  function editCards(change: (cards: DraftFlashcard[]) => DraftFlashcard[]) {
    edit((current) => ({ ...current, flashcards: change(current.flashcards) }));
  }

  function addCard() {
    const card = newFlashcard();
    editCards((cards) => [...cards, card]);
    window.setTimeout(() => document.getElementById(fieldIds.front(card.id))?.focus(), 0);
  }

  return (
    <div className="grid gap-6">
      <p className="text-muted-foreground">
        A term or question on the front, a short explanation on the back. Learners flip through them to review.
      </p>
      <ol className="grid gap-4">
        {draft.flashcards.map((card, index) => {
          const label = `Flashcard ${index + 1}`;
          return (
            <li key={card.id} className="grid gap-4 rounded-xl border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{label}</h3>
                <ItemControls
                  itemLabel={label.toLowerCase()}
                  index={index}
                  total={draft.flashcards.length}
                  onMove={(delta) => editCards((cards) => move(cards, index, delta))}
                  onRemove={() => {
                    editCards((cards) => removeAt(cards, index));
                    window.setTimeout(() => document.getElementById(headingId)?.focus(), 0);
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Field>
                  <FieldLabel htmlFor={fieldIds.front(card.id)}>Front</FieldLabel>
                  <Input
                    id={fieldIds.front(card.id)}
                    value={card.front}
                    onChange={(event) => editCards((cards) => replaceAt(cards, index, { ...card, front: event.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={fieldIds.back(card.id)}>Back</FieldLabel>
                  <Textarea
                    id={fieldIds.back(card.id)}
                    value={card.back}
                    className="min-h-16"
                    onChange={(event) => editCards((cards) => replaceAt(cards, index, { ...card, back: event.target.value }))}
                  />
                </Field>
              </div>
            </li>
          );
        })}
      </ol>
      <Button type="button" variant="outline" onClick={addCard} className="justify-self-start">
        <Plus aria-hidden="true" data-icon="inline-start" />
        Add flashcard
      </Button>
    </div>
  );
}
