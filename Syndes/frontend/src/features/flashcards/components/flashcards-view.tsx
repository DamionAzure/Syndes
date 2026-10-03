"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { StepProgress } from "@/components/ui/step-progress";
import { cn } from "@/lib/utils";
import { ModuleBreadcrumb } from "@/features/modules/components/module-breadcrumb";
import { ModuleNotFound } from "@/features/modules/components/module-not-found";
import type { Flashcard as FlashcardData, Module } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";
import { VersionResetNotice } from "@/features/modules/components/version-reset-notice";
import { useModuleParam } from "@/features/modules/use-module-param";
import { useModuleProgress } from "@/features/progress/use-progress";
import { Flashcard, type CardSide } from "./flashcard";

export function FlashcardsView() {
  const found = useModuleParam();
  if (!found) return <ModuleNotFound />;
  // Backs come only from the teacher-approved deck, never from Quiz data.
  if (!found.flashcards || found.flashcards.length === 0) return <NoFlashcards found={found} />;
  return <FlashcardDeck key={found.id} found={found} cards={found.flashcards} />;
}

function NoFlashcards({ found }: { found: Module }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <span aria-hidden="true" className="grid size-12 place-content-center rounded-lg bg-surface-muted text-primary">
        <Layers className="size-6" />
      </span>
      <h1 className="text-page font-semibold">This module has no flashcards</h1>
      <p className="max-w-[52ch] text-muted-foreground">
        {found.title} does not include a flashcard deck from your teacher.
      </p>
      <Link href={routes.module(found.id)} className={buttonVariants({ variant: "outline", className: "mt-3" })}>
        Back to the module
      </Link>
    </div>
  );
}

function FlashcardDeck({ found, cards }: { found: Module; cards: FlashcardData[] }) {
  // Viewing any part of an updated Module discards its stale Progress and says so.
  const { versionReset } = useModuleProgress(found);
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<CardSide>("front");
  const card = cards[index];
  const total = cards.length;

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= total) return;
    setIndex(nextIndex);
    setSide("front");
  }

  function flip() {
    setSide((current) => (current === "front" ? "back" : "front"));
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      flip();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    }
  }

  if (!card) return <NoFlashcards found={found} />;

  return (
    <>
      <PageHeader
        icon={Layers}
        context={<ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} current="Flashcards" />}
        title="Flashcards"
        description={found.title}
      />
      {versionReset ? <VersionResetNotice /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <section
          aria-label="Card"
          className="grid justify-items-center gap-6 rounded-xl border border-border bg-surface-muted/50 p-6 sm:p-10"
        >
          <p className="text-meta text-muted-foreground" aria-live="polite">
            Card {index + 1} of {total}
          </p>
          <Flashcard card={card} side={side} onKeyDown={onCardKeyDown} />
          <div className="flex w-full max-w-[28rem] flex-wrap justify-between gap-4">
            <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0} focusableWhenDisabled>
              Previous
            </Button>
            <Button onClick={flip}>Flip</Button>
            <Button variant="outline" onClick={() => goTo(index + 1)} disabled={index === total - 1} focusableWhenDisabled>
              Next
            </Button>
          </div>
        </section>

        <aside aria-label="About this deck" className="grid gap-6 lg:sticky lg:top-8">
          <nav aria-labelledby="deck-heading" className="rounded-xl border border-border bg-surface p-5">
            <h2 id="deck-heading" className="text-body font-semibold">
              In this deck
            </h2>
            <StepProgress current={index + 1} total={total} label={`${total} cards`} className="mt-3" />
            <ol className="mt-4 grid gap-1">
              {cards.map((entry, entryIndex) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => goTo(entryIndex)}
                    aria-current={entryIndex === index ? "step" : undefined}
                    className={cn(
                      "flex min-h-(--control-height) w-full items-center gap-3 rounded-lg px-2 text-left text-meta hover:bg-surface-muted",
                      entryIndex === index && "bg-surface-muted font-semibold",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-content-center rounded-md border border-border tabular-nums",
                        entryIndex === index && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {entryIndex + 1}
                    </span>
                    <span className="truncate">{entry.front}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <section aria-labelledby="keys-heading" className="rounded-xl border border-border bg-surface p-5 text-meta">
            <h2 id="keys-heading" className="text-body font-semibold">
              Keyboard
            </h2>
            <p id="flashcard-keys" className="mt-1 text-muted-foreground">
              With the card focused:
            </p>
            <dl className="mt-3 grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Flip</dt>
                <dd className="flex gap-1">
                  <kbd className="rounded-md border border-border bg-surface-muted px-2 py-0.5">Space</kbd>
                  <kbd className="rounded-md border border-border bg-surface-muted px-2 py-0.5">Enter</kbd>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Previous or next card</dt>
                <dd className="flex gap-1">
                  <kbd aria-label="Left arrow" className="rounded-md border border-border bg-surface-muted px-2 py-0.5">←</kbd>
                  <kbd aria-label="Right arrow" className="rounded-md border border-border bg-surface-muted px-2 py-0.5">→</kbd>
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
