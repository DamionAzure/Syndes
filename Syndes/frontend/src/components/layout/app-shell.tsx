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
          <div className="sticky top-0 flex h-dvh flex-col gap-8 overflow-y-auto px-4 py-5">
            <div className="px-1">
              <Wordmark />
            </div>
            <SiteNav />
            <ConnectionStatus className="mt-auto rounded-lg border border-border bg-surface px-3 py-2" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-2 sm:px-6 lg:hidden">
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
