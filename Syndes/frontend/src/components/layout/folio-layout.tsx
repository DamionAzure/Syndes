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
 * the page from 1024px and the margin from 1280px; before that they stack
 * above and below the reader, in source order. Rail and margin stay in view
 * while a long lesson scrolls.
 */
export function FolioLayout({
  rail,
  margin,
  children,
  railLabel = "Lesson sequence",
  marginLabel = "Study margin",
}: FolioLayoutProps) {
  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_17rem]">
      <aside
        aria-label={railLabel}
        className="border-b border-border bg-surface-muted p-5 lg:border-r lg:border-b-0"
      >
        <div className="lg:sticky lg:top-8">{rail}</div>
      </aside>
      <div className="min-w-0 px-6 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto max-w-[44rem]">{children}</div>
      </div>
      <aside
        aria-label={marginLabel}
        className="border-t border-border p-6 lg:col-span-2 xl:col-span-1 xl:border-t-0 xl:border-l"
      >
        <div className="xl:sticky xl:top-8">{margin}</div>
      </aside>
    </div>
  );
}
