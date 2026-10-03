"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAccess } from "@/components/access/access-provider";
import { ResetProgressDialog } from "@/features/progress/components/reset-progress-dialog";
import { resetLocalAccountData } from "../legacy-import";
import { applyPreferences, savePreferences, usePreferences } from "../preferences";
import { LargerControlsSwitch } from "./larger-controls-switch";
import { ThemeChoice } from "./theme-choice";
import { LegacyImport } from "./legacy-import";

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
  const access = useAccess();
  const [resetError, setResetError] = useState(false);

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
      <LegacyImport kind="progress" />
      {access.accountId ? (
        <SettingRow id="local-data" title="Local Account data" description="Remove this Account's offline Modules, Progress, answers and Drafts from this device. Other Accounts remain here.">
          <ResetProgressDialog
            triggerLabel="Reset local Account data"
            title="Remove this Account's local data?"
            description="Offline Modules, Progress, answers and Drafts for this Account will be deleted from this device. This cannot be undone."
            confirmLabel="Remove local data"
            focusAfterResetId="main-content"
            onConfirm={() => {
              if (!access.accountId) return;
              void resetLocalAccountData(window.localStorage, access.accountId).catch(() => setResetError(true));
            }}
          />
          {resetError ? <p role="alert" className="mt-2 text-meta text-destructive">Local data could not be removed. Try again.</p> : null}
        </SettingRow>
      ) : null}
    </div>
  );
}
