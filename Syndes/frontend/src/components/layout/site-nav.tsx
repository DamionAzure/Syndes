"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { currentState, type NavRoute } from "./nav-routes";

type SiteNavProps = {
  label: string;
  routes: readonly NavRoute[];
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
};

export function SiteNav({
  label,
  routes,
  orientation = "horizontal",
  onNavigate,
}: SiteNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul
        className={cn(
          "flex",
          orientation === "horizontal" ? "items-center gap-1" : "flex-col gap-1",
        )}
      >
        {routes.map((route) => {
          const current = currentState(route, pathname);
          return (
            <li key={route.href}>
              <Link
                href={route.href}
                aria-current={current}
                onClick={() => onNavigate?.()}
                className={cn(
                  "flex min-h-(--control-height) items-center rounded-md px-3 text-meta text-muted-foreground hover:text-foreground",
                  "border-b-2 border-transparent",
                  current && "border-primary font-medium text-foreground",
                  orientation === "vertical" &&
                    "border-b-0 border-l-2 text-body",
                )}
              >
                {route.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
