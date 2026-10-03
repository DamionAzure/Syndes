"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { resetSampleDirectory } from "../use-directory";

/** Sample mode only: undo every change made while trying the screens. */
export function ResetSampleButton({ focusAfterId }: { focusAfterId: string }) {
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="sm" className="-ml-2 justify-self-start sm:ml-0 sm:justify-self-end" />}
      triggerLabel="Reset sample school"
      title="Reset the sample school?"
      description="Every change you made to the sample people, sections and classes on this device will be undone."
      confirmLabel="Reset sample school"
      onConfirm={resetSampleDirectory}
      focusAfterId={focusAfterId}
    />
  );
}
