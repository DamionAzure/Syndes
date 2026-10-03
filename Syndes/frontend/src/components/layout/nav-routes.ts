import {
  Bookmark,
  CalendarDays,
  ChartColumn,
  FilePenLine,
  GraduationCap,
  House,
  LibraryBig,
  ListChecks,
  School,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavRoute = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other paths that belong to this route's section. */
  sectionPaths?: readonly string[];
};

export type NavGroup = {
  label: string;
  routes: readonly NavRoute[];
  /** "teacher" groups are listed only after the core confirms a Teacher or Admin. */
  audience?: "teacher";
};

/** Hides teacher-only groups unless access is confirmed; while checking, it is hidden too. */
export function visibleGroups(groups: readonly NavGroup[], canTeach: boolean): NavGroup[] {
  return groups.filter((group) => group.audience !== "teacher" || canTeach);
}

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
    // Hiding the group is wayfinding only; TeachGuard and the Rust core enforce access (ADR-0005).
    label: "Teach",
    audience: "teacher",
    routes: [
      { href: "/teach", label: "Teaching", icon: School },
      { href: "/teach/drafts", label: "Editor", icon: FilePenLine, sectionPaths: ["/teach/editor"] },
      { href: "/teach/learners", label: "Learners", icon: Users, sectionPaths: ["/teach/learner"] },
      { href: "/teach/scores", label: "Scores", icon: ChartColumn },
      { href: "/teach/grades", label: "Grades", icon: GraduationCap },
      { href: "/teach/schedule", label: "Schedule", icon: CalendarDays },
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
