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
    <div className="mt-10 grid gap-10">
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
