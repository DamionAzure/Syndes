"use client";

import { FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { THEME_CHOICES, type ThemeChoice } from "../preferences";

const THEME_TEXT: Record<ThemeChoice, { label: string; hint: string }> = {
  light: { label: "Light", hint: "Paper and ink. The default." },
  dark: { label: "Dark", hint: "Blue charcoal with softened text." },
  system: { label: "System", hint: "Follows your device setting." },
};

/** A small page drawn in the theme's own tokens, so each choice shows what it does. */
function ThemePreview({ theme }: { theme: "light" | "dark" }) {
  return (
    <span data-theme={theme} aria-hidden="true" className="grid h-full grid-rows-[auto_1fr] gap-1.5 bg-background p-2">
      <span className="h-1.5 w-1/2 rounded-full bg-foreground/70" />
      <span className="grid grid-cols-[1fr_2fr] gap-1.5">
        <span className="rounded-sm bg-surface-muted" />
        <span className="grid content-start gap-1 rounded-sm bg-surface p-1.5">
          <span className="h-1 w-full rounded-full bg-muted-foreground/50" />
          <span className="h-1 w-3/4 rounded-full bg-muted-foreground/50" />
          <span className="mt-1 h-2 w-1/2 rounded-sm bg-primary" />
        </span>
      </span>
    </span>
  );
}

export function ThemeChoice({
  value,
  onChange,
  labelledBy,
}: {
  value: ThemeChoice;
  onChange: (theme: ThemeChoice) => void;
  labelledBy: string;
}) {
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={value}
      onValueChange={(next) => {
        const theme = THEME_CHOICES.find((choice) => choice === next);
        if (theme) onChange(theme);
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      {THEME_CHOICES.map((choice) => (
        <FieldLabel
          key={choice}
          htmlFor={`theme-${choice}`}
          className="grid w-full cursor-pointer gap-0 overflow-hidden rounded-lg border-2 border-border bg-surface has-data-checked:border-primary dark:has-data-checked:border-primary"
        >
          <span className="block h-20 border-b border-border">
            {choice === "system" ? (
              <span className="grid h-full grid-cols-2">
                <ThemePreview theme="light" />
                <ThemePreview theme="dark" />
              </span>
            ) : (
              <ThemePreview theme={choice} />
            )}
          </span>
          <span className="flex items-start gap-3 p-3">
            <RadioGroupItem value={choice} id={`theme-${choice}`} className="mt-1" />
            <span className="grid gap-0.5">
              <span className="text-body font-medium">{THEME_TEXT[choice].label}</span>
              <span className="text-meta font-normal text-muted-foreground">{THEME_TEXT[choice].hint}</span>
            </span>
          </span>
        </FieldLabel>
      ))}
    </RadioGroup>
  );
}
