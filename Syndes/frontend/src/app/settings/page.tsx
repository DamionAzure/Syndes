import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { SettingsView } from "@/features/settings/components/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading settings…" />}>
      <SettingsView />
    </LocalDataBoundary>
  );
}
