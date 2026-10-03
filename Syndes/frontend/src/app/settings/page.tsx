import { Settings2 } from "lucide-react";
import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsView } from "@/features/settings/components/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader icon={Settings2} title="Settings" description="How Syndes looks and feels. Saved on this device." />
      <LocalDataBoundary fallback={<LoadingState label="Loading settings…" />}>
        <SettingsView />
      </LocalDataBoundary>
    </>
  );
}
