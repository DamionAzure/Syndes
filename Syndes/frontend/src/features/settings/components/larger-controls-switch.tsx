"use client";

import { Switch } from "@/components/ui/switch";

/** The labelled switch; its heading and description live in the settings row. */
export function LargerControlsSwitch({
  checked,
  onChange,
  labelledBy,
  describedBy,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy: string;
  describedBy: string;
}) {
  return (
    <label className="flex min-h-(--control-height) cursor-pointer items-center justify-between gap-6 rounded-lg border border-border bg-surface px-4 py-3">
      <span className="font-medium">{checked ? "On" : "Off"}</span>
      <Switch
        id="larger-controls"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        checked={checked}
        onCheckedChange={onChange}
      />
    </label>
  );
}
