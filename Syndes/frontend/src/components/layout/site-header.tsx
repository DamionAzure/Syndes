import Link from "next/link";
import { ConnectionStatus } from "./connection-status";
import { MobileNavSheet } from "./mobile-nav-sheet";
import { PRIMARY_ROUTES, SECONDARY_ROUTES } from "./nav-routes";
import { SiteNav } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[90rem] items-center gap-4 px-4 py-2 sm:px-8">
        <Link
          href="/"
          className="flex min-h-(--control-height) items-center gap-3 rounded-md text-section font-semibold"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-content-center gap-[3px] rounded-sm bg-primary"
          >
            <span className="block h-[2px] w-4 bg-primary-foreground" />
            <span className="block h-[2px] w-4 bg-primary-foreground" />
            <span className="block h-[2px] w-3 bg-primary-foreground" />
          </span>
          Syndes
        </Link>

        <div className="hidden flex-1 items-center justify-between gap-4 md:flex">
          <SiteNav label="Main" routes={PRIMARY_ROUTES} />
          <div className="flex items-center gap-4">
            <SiteNav label="Your device" routes={SECONDARY_ROUTES} />
            <ConnectionStatus />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3 md:hidden">
          <ConnectionStatus />
          <MobileNavSheet />
        </div>
      </div>
    </header>
  );
}
