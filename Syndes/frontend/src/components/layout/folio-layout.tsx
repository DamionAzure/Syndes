import type { ReactNode } from "react";

type FolioLayoutProps = {
  rail: ReactNode;
  margin: ReactNode;
  children: ReactNode;
};

/**
 * Chapter rail, reading page, and study margin. On wide screens the rail and
 * margin sit outside the 44rem reading measure; below 1024px they stack
 * above and below it, in source order.
 */
export function FolioLayout({ rail, margin, children }: FolioLayoutProps) {
  return (
    <div className="mx-auto grid max-w-[82rem] border border-border lg:grid-cols-[16rem_minmax(0,44rem)_minmax(14rem,1fr)]">
      <aside
        aria-label="Lesson sequence"
        className="border-b border-border bg-surface-muted p-6 lg:border-r lg:border-b-0"
      >
        {rail}
      </aside>
      <div className="bg-surface p-6 sm:p-10">{children}</div>
      <aside
        aria-label="Study margin"
        className="border-t border-border bg-surface p-6 lg:border-t-0 lg:border-l"
      >
        {margin}
      </aside>
    </div>
  );
}
