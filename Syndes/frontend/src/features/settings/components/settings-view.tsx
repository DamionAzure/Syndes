"use client";

import { useEffect, type ReactNode } from "react";
import { applyPreferences, savePreferences, usePreferences } from "../preferences";
import { LargerControlsSwitch } from "./larger-controls-switch";
import { ThemeChoice } from "./theme-choice";

/** What the setting is on the left, the control on the right. */
function SettingRow({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="grid gap-4 px-6 py-6 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10"
    >
      <div>
        <h2 id={`${id}-heading`} className="text-body font-semibold">
          {title}
        </h2>
        <p id={`${id}-hint`} className="mt-1 text-meta text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const preferences = usePreferences();

  // Keep <html> in step when another tab changes the saved preferences.
  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      <SettingRow id="theme" title="Theme" description="Light is the default. System follows your device.">
        <ThemeChoice
          labelledBy="theme-heading"
          value={preferences.theme}
          onChange={(theme) => savePreferences({ ...preferences, theme })}
        />
      </SettingRow>
      <SettingRow
        id="larger-controls"
        title="Larger controls"
        description="Makes buttons, fields, and answer rows taller and easier to tap."
      >
        <LargerControlsSwitch
          labelledBy="larger-controls-heading"
          describedBy="larger-controls-hint"
          checked={preferences.largerControls}
          onChange={(largerControls) => savePreferences({ ...preferences, largerControls })}
        />
      </SettingRow>
    </div>
  );
}
