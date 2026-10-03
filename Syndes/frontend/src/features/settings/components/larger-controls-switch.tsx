"use client";

import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

export function LargerControlsSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="items-center justify-between gap-6 border-y border-border py-4">
      <FieldContent>
        <FieldLabel htmlFor="larger-controls" className="text-section font-semibold">
          Larger controls
        </FieldLabel>
        <FieldDescription id="larger-controls-hint">
          Makes buttons, fields, and answer rows taller and easier to tap.
        </FieldDescription>
      </FieldContent>
      <Switch
        id="larger-controls"
        aria-describedby="larger-controls-hint"
        checked={checked}
        onCheckedChange={onChange}
      />
    </Field>
  );
}
