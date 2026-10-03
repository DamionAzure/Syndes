import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsView } from "@/features/settings/components/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[44rem]">
      <PageHeader title="Settings">Saved on this device.</PageHeader>
      <LocalDataBoundary fallback={<LoadingState label="Loading settings…" />}>
        <SettingsView />
      </LocalDataBoundary>
    </div>
  );
}
