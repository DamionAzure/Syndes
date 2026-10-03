import { Bookmark, House, LibraryBig, ListChecks, Settings2, type LucideIcon } from "lucide-react";

export type NavRoute = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other paths that belong to this route's section. */
  sectionPaths?: readonly string[];
};

export type NavGroup = { label: string; routes: readonly NavRoute[] };

/** Learning first; the device-only pages sit in their own group. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Learn",
    routes: [
      { href: "/", label: "Home", icon: House },
      {
        href: "/modules",
        label: "Modules",
        icon: LibraryBig,
        sectionPaths: ["/module", "/lesson", "/flashcards"],
      },
      { href: "/quizzes", label: "Quizzes", icon: ListChecks, sectionPaths: ["/quiz", "/quiz/result"] },
    ],
  },
  {
    label: "On this device",
    routes: [
      { href: "/progress", label: "Progress", icon: Bookmark },
      { href: "/settings", label: "Settings", icon: Settings2 },
    ],
  },
];

/** `page` for the route itself, `true` for a page inside its section. */
export function ariaCurrentFor(
  route: NavRoute,
  pathname: string,
): "page" | "true" | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (path === route.href) return "page";
  if (route.sectionPaths?.includes(path)) return "true";
  return undefined;
}
