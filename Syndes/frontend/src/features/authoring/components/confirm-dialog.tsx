"use client";

import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Confirms a removal and says exactly what goes. Cancelling returns focus to
 * the trigger; after confirming, the trigger is usually gone, so focus moves
 * to `focusAfterId`.
 */
export function ConfirmDialog({
  trigger,
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  focusAfterId,
}: {
  trigger: ReactElement;
  triggerLabel: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  focusAfterId: string;
}) {
  const [open, setOpen] = useState(false);
  const confirmed = useRef(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) confirmed.current = false;
        setOpen(next);
      }}
    >
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="gap-6 p-6 sm:max-w-[30rem]"
        finalFocus={() => (confirmed.current ? document.getElementById(focusAfterId) : true)}
      >
        <DialogHeader>
          <DialogTitle className="text-section leading-snug font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-body text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 bg-surface-muted p-6">
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              confirmed.current = true;
              onConfirm();
              setOpen(false);
              window.setTimeout(() => document.getElementById(focusAfterId)?.focus(), 0);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
