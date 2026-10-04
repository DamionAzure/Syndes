import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { AdminGuard } from "@/components/access/admin-guard";
import { ResetSampleButton } from "@/features/school-directory/components/reset-sample-button";
import { MAIN_CONTENT_ID } from "@/components/layout/app-shell";

/**
 * Administration renders only for a verified Administrator (ADR-0008 proposal). The
 * changes made here run against a sample school until the Supabase
 * directory is connected, and every page says so.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <div
        role="note"
        className="mb-6 grid grid-cols-1 items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-muted px-4 py-2 text-meta text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <span className="flex min-w-0 items-start gap-2 py-1">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">Sample school.</span> People, sections and statistics are
            fictional, and your changes are kept on this device only until the school directory is connected.
          </span>
        </span>
        <ResetSampleButton focusAfterId={MAIN_CONTENT_ID} />
      </div>
      {children}
    </AdminGuard>
  );
}
