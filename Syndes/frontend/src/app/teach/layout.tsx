import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { TeachGuard } from "@/components/access/teach-guard";

/**
 * Teacher pages render only for a verified Teacher or Admin (ADR-0005), and
 * say up front that their class records are sample data until records are
 * reported from Learner devices (ADR-0004).
 */
export default function TeachLayout({ children }: { children: ReactNode }) {
  return (
    <TeachGuard>
      <p
        role="note"
        className="mb-6 flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-4 py-3 text-meta text-muted-foreground"
      >
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          <span className="font-medium text-foreground">Sample class data.</span> Learners, scores, grades and the
          schedule are fictional until records are reported from Learner devices. Drafts you write are real and saved
          on this device.
        </span>
      </p>
      {children}
    </TeachGuard>
  );
}
