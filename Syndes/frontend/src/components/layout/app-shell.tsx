import type { ReactNode } from "react";
import { ConnectionStatus } from "./connection-status";
import { MobileNavSheet } from "./mobile-nav-sheet";
import { SiteNav } from "./site-nav";
import { Wordmark } from "./wordmark";

export const MAIN_CONTENT_ID = "main-content";

/**
 * A fixed sidebar on wide screens keeps every section one glance away and
 * uses the space beside the content; narrow screens get a top bar and a Sheet.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-surface-muted lg:block">
          {/* Wordmark and status stay put; only the routes scroll when a role has many of them. */}
          <div className="sticky top-0 flex h-dvh flex-col">
            <div className="shrink-0 px-5 pt-5 pb-6">
              <Wordmark />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              <SiteNav />
            </div>
            <div className="shrink-0 border-t border-border px-4 py-4">
              <ConnectionStatus className="rounded-lg border border-border bg-surface px-3 py-2" />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          {/* Top padding grows by --safe-top so the Android status bar never covers the wordmark. */}
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 pt-[calc(0.5rem+var(--safe-top))] pb-2 sm:px-6 lg:hidden">
            <Wordmark />
            <div className="ml-auto flex items-center gap-3">
              <ConnectionStatus />
              <MobileNavSheet />
            </div>
          </header>
          <main
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            className="mx-auto w-full max-w-[80rem] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8"
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
