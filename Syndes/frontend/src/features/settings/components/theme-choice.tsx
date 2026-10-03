"use client";

import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { THEME_CHOICES, type ThemeChoice } from "../preferences";

const THEME_TEXT: Record<ThemeChoice, { label: string; hint: string }> = {
  light: { label: "Light", hint: "Paper and ink. The default." },
  dark: { label: "Dark", hint: "Blue charcoal with softened text." },
  system: { label: "System", hint: "Follows your device setting." },
};

export function ThemeChoice({
  value,
  onChange,
}: {
  value: ThemeChoice;
  onChange: (theme: ThemeChoice) => void;
}) {
  return (
    <FieldSet>
      <FieldLegend id="theme-legend" className="text-section font-semibold">Theme</FieldLegend>
      <RadioGroup
        aria-labelledby="theme-legend"
        value={value}
        onValueChange={(next) => {
          const theme = THEME_CHOICES.find((choice) => choice === next);
          if (theme) onChange(theme);
        }}
        className="gap-3"
      >
        {THEME_CHOICES.map((choice) => (
          <FieldLabel
            key={choice}
            htmlFor={`theme-${choice}`}
            className="w-full cursor-pointer rounded-md border-2 border-border bg-surface has-data-checked:border-primary has-data-checked:bg-surface-muted dark:has-data-checked:border-primary dark:has-data-checked:bg-surface-muted"
          >
            <Field orientation="horizontal" className="min-h-(--control-height) items-center gap-4 px-4 py-2">
              <RadioGroupItem value={choice} id={`theme-${choice}`} />
              <span className="grid gap-0.5">
                <span className="text-body font-medium">{THEME_TEXT[choice].label}</span>
                <FieldDescription>{THEME_TEXT[choice].hint}</FieldDescription>
              </span>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}
