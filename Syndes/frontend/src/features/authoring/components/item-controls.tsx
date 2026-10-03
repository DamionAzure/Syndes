"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ModuleDraft } from "../draft-types";

export type EditDraft = (change: (draft: ModuleDraft) => ModuleDraft) => void;

/** Reorder and remove for one item in a list, each named for the item it acts on. */
export function ItemControls({
  itemLabel,
  index,
  total,
  onMove,
  onRemove,
}: {
  itemLabel: string;
  index: number;
  total: number;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${itemLabel} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${itemLabel} down`}
        disabled={index === total - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${itemLabel}`} onClick={onRemove}>
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Whole, non-negative numbers only; anything else keeps the previous value. */
export function wholeNumber(raw: string, previous: number): number {
  if (raw.trim() === "") return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : previous;
}
