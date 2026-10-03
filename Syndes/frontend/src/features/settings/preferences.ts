import { useSyncExternalStore } from "react";
import { createStoredValue } from "@/lib/local-json-storage";
import { PREFERENCES_KEY } from "./preference-script";

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type Preferences = {
  theme: ThemeChoice;
  largerControls: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "light",
  largerControls: false,
};

function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some((choice) => choice === value);
}

export function parsePreferences(raw: unknown): Preferences {
  if (typeof raw !== "object" || raw === null) return DEFAULT_PREFERENCES;
  const record = raw as Record<string, unknown>;
  return {
    theme: isThemeChoice(record["theme"])
      ? record["theme"]
      : DEFAULT_PREFERENCES.theme,
    largerControls: record["largerControls"] === true,
  };
}

const preferencesValue = createStoredValue(
  PREFERENCES_KEY,
  parsePreferences,
  DEFAULT_PREFERENCES,
);

/** Mirrors the pre-paint script so a change applies without a reload. */
export function applyPreferences(
  preferences: Preferences,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset["theme"] = preferences.theme;
  root.dataset["controls"] = preferences.largerControls ? "large" : "default";
}

export function savePreferences(preferences: Preferences): void {
  preferencesValue.set(preferences);
  applyPreferences(preferences);
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    preferencesValue.subscribe,
    preferencesValue.get,
    preferencesValue.getServerSnapshot,
  );
}
