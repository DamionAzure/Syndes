export type NavRoute = {
  href: string;
  label: string;
  /** Other paths that belong to this route's section. */
  sectionPaths?: readonly string[];
};

export const PRIMARY_ROUTES: readonly NavRoute[] = [
  { href: "/", label: "Home" },
  {
    href: "/modules",
    label: "Modules",
    sectionPaths: ["/module", "/lesson", "/flashcards"],
  },
  { href: "/quizzes", label: "Quizzes", sectionPaths: ["/quiz", "/quiz/result"] },
];

export const SECONDARY_ROUTES: readonly NavRoute[] = [
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

/** `page` for the route itself, `true` for a page inside its section. */
export function currentState(
  route: NavRoute,
  pathname: string,
): "page" | "true" | undefined {
  if (pathname === route.href) return "page";
  if (route.sectionPaths?.includes(pathname)) return "true";
  return undefined;
}
