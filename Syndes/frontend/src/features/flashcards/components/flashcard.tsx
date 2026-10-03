import type { KeyboardEvent, Ref } from "react";
import type { Flashcard as FlashcardData } from "@/features/modules/module-types";

export type CardSide = "front" | "back";

/**
 * One large square card. Flipping swaps the content without animation, so it
 * behaves the same with reduced motion.
 */
export function Flashcard({
  card,
  side,
  onKeyDown,
  cardRef,
}: {
  card: FlashcardData;
  side: CardSide;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  cardRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={cardRef}
      tabIndex={0}
      role="group"
      aria-roledescription="flashcard"
      aria-label={side === "front" ? "Front of card" : "Back of card"}
      aria-describedby="flashcard-keys"
      onKeyDown={onKeyDown}
      className="grid aspect-square w-full max-w-[28rem] grid-rows-[auto_1fr] rounded-2xl border border-border bg-surface p-8"
    >
      <p className="text-meta text-muted-foreground">{side === "front" ? "Front" : "Back"}</p>
      <p
        aria-live="polite"
        className={
          side === "front"
            ? "self-center text-center text-page font-semibold"
            : "self-center text-center text-section leading-[1.5]"
        }
      >
        {side === "front" ? card.front : card.back}
      </p>
    </div>
  );
}
