"use client";

import { useEffect } from "react";
import { applyPreferences, savePreferences, usePreferences } from "../preferences";
import { LargerControlsSwitch } from "./larger-controls-switch";
import { ThemeChoice } from "./theme-choice";

export function SettingsView() {
  const preferences = usePreferences();

  // Keep <html> in step when another tab changes the saved preferences.
  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  return (
    <div className="mx-auto grid max-w-[44rem] gap-10">
      <div>
        <h1 className="text-title font-semibold">Settings</h1>
        <p className="mt-3 text-muted-foreground">Saved on this device.</p>
      </div>
      <ThemeChoice
        value={preferences.theme}
        onChange={(theme) => savePreferences({ ...preferences, theme })}
      />
      <LargerControlsSwitch
        checked={preferences.largerControls}
        onChange={(largerControls) => savePreferences({ ...preferences, largerControls })}
      />
    </div>
  );
}
