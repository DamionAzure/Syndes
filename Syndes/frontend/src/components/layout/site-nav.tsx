"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccess } from "@/components/access/access-provider";
import { cn } from "@/lib/utils";
import { ariaCurrentFor, NAV_GROUPS, visibleGroups } from "./nav-routes";

/**
 * Grouped, labelled routes. The current section gets a filled row, a primary
 * marker, and bold text, so "where am I" never depends on colour alone.
 */
export function SiteNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const access = useAccess();

  return (
    <nav aria-label="Main" className="grid gap-6">
      {visibleGroups(NAV_GROUPS, access).map((group) => (
        <div key={group.label}>
          <h2 className="px-3 pb-2 text-meta text-muted-foreground">{group.label}</h2>
          <ul className="grid gap-1">
            {group.routes.map((route) => {
              const current = ariaCurrentFor(route, pathname);
              const Icon = route.icon;
              return (
                <li key={route.href}>
                  <Link
                    href={route.href}
                    aria-current={current}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "relative flex min-h-(--control-height) items-center gap-3 rounded-md px-3 text-muted-foreground hover:bg-surface hover:text-foreground",
                      current &&
                        "bg-surface font-semibold text-foreground before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary",
                    )}
                  >
                    <Icon aria-hidden="true" className={cn("size-5 shrink-0", current && "text-primary")} />
                    {route.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
