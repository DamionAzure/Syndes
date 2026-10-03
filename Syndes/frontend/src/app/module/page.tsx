import type { Metadata } from "next";
import { LoadingState, LocalDataBoundary } from "@/components/layout/local-data-boundary";
import { ModuleOverviewView } from "@/features/modules/components/module-overview-view";

export const metadata: Metadata = { title: "Module overview" };

export default function ModulePage() {
  return (
    <LocalDataBoundary fallback={<LoadingState label="Loading the module…" />}>
      <ModuleOverviewView />
    </LocalDataBoundary>
  );
}
