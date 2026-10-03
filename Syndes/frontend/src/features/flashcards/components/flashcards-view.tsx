"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
    <div className="mx-auto max-w-[56rem]">
      <h1 className="text-page font-semibold">This module has no flashcards</h1>
      <p className="mt-3 text-muted-foreground">
        {found.title} does not include a flashcard deck from your teacher.
      </p>
      <Link href={routes.module(found.id)} className={buttonVariants({ variant: "outline", className: "mt-6" })}>
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
    <div className="mx-auto max-w-[44rem]">
      <ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} current="Flashcards" />
      {versionReset ? <VersionResetNotice /> : null}
      <h1 className="text-page font-semibold">Flashcards</h1>
      <p className="mt-2 text-muted-foreground" aria-live="polite">
        Card {index + 1} of {total}
      </p>

      <div className="mt-8 grid justify-items-center gap-6">
        <Flashcard card={card} side={side} onKeyDown={onCardKeyDown} />
        <p id="flashcard-keys" className="text-meta text-muted-foreground">
          With the card focused, press Space or Enter to flip, and the arrow keys to move.
        </p>
        <div className="flex w-full max-w-[28rem] flex-wrap justify-between gap-4">
          <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0} focusableWhenDisabled>
            Previous
          </Button>
          <Button onClick={flip}>Flip</Button>
          <Button variant="outline" onClick={() => goTo(index + 1)} disabled={index === total - 1} focusableWhenDisabled>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
