import type { ReactNode } from "react";

/**
 * Static page title and orientation, rendered by the route as a Server
 * Component so the heading is in the prerendered HTML before local data loads.
 */
export function PageHeader({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <header>
      <h1 id={id} tabIndex={-1} className="text-title font-semibold">
        {title}
      </h1>
      <p className="mt-3 max-w-[62ch] text-muted-foreground">{children}</p>
    </header>
  );
}
