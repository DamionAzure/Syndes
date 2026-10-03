import type { ReactNode } from "react";

type FolioLayoutProps = {
  rail: ReactNode;
  margin: ReactNode;
  children: ReactNode;
  /** Accessible names for the two side regions; the lesson reader keeps the defaults. */
  railLabel?: string;
  marginLabel?: string;
};

/**
 * Chapter rail, reading page, and study margin in one panel. The rail joins
 * the page from 1024px and the margin from 1536px, so laptop screens keep a
 * full reading measure; before that the margin sits under the page, laid out
 * across its width. Rail and margin stay in view while a long lesson scrolls.
 */
export function FolioLayout({
  rail,
  margin,
  children,
  railLabel = "Lesson sequence",
  marginLabel = "Study margin",
}: FolioLayoutProps) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)_17rem]">
      <aside
        aria-label={railLabel}
        className="min-w-0 border-b border-border bg-surface-muted p-5 lg:border-r lg:border-b-0"
      >
        <div className="lg:sticky lg:top-8">{rail}</div>
      </aside>
      <div className="min-w-0 px-5 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto max-w-[44rem]">{children}</div>
      </div>
      <aside
        aria-label={marginLabel}
        className="min-w-0 border-t border-border bg-surface p-6 lg:col-span-2 2xl:col-span-1 2xl:border-t-0 2xl:border-l"
      >
        <div className="mx-auto max-w-[44rem] 2xl:sticky 2xl:top-8 2xl:mx-0 2xl:max-w-none">{margin}</div>
      </aside>
    </div>
  );
}
