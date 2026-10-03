"use client";

import { useRef, useState, type RefObject } from "react";
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
 * Confirms a reset and says what will be removed. After a confirmed reset the
 * trigger is gone, so focus moves to `focusAfterReset`; cancelling returns
 * focus to the trigger.
 */
export function ResetProgressDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  focusAfterReset,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  focusAfterReset: RefObject<HTMLElement | null>;
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
      <DialogTrigger render={<Button variant="outline" />}>{triggerLabel}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="gap-6 p-6 sm:max-w-[30rem]"
        finalFocus={() => (confirmed.current ? focusAfterReset.current : true)}
      >
        <DialogHeader>
          <DialogTitle className="text-section font-semibold leading-snug">{title}</DialogTitle>
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
              // The reset can unmount this dialog before it restores focus.
              window.setTimeout(() => focusAfterReset.current?.focus(), 0);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
