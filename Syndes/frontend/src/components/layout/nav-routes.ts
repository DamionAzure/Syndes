import {
  Bookmark,
  CalendarDays,
  ChartColumn,
  FilePenLine,
  GraduationCap,
  History,
  House,
  Landmark,
  LayoutGrid,
  LibraryBig,
  ListChecks,
  School,
  Settings2,
  UserCog,
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

export type NavAudience = "teacher" | "admin";

export type NavGroup = {
  label: string;
  routes: readonly NavRoute[];
  /** Groups with an audience are listed only after the core confirms that role. */
  audience?: NavAudience;
};

export type NavAccess = { canTeach: boolean; canAdminister: boolean };

/** Hides role-only groups unless that role is confirmed; while checking, they stay hidden. */
export function visibleGroups(groups: readonly NavGroup[], access: NavAccess): NavGroup[] {
  return groups.filter((group) => {
    if (group.audience === "teacher") return access.canTeach;
    if (group.audience === "admin") return access.canAdminister;
    return true;
  });
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
    // Hiding the group is wayfinding only; TeachGuard and the Rust core enforce access (ADR-0006).
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
    // Wayfinding only; AdminGuard and Supabase's admin-only functions enforce access (ADR-0007).
    label: "Administration",
    audience: "admin",
    routes: [
      { href: "/admin", label: "School", icon: Landmark },
      { href: "/admin/people", label: "People and access", icon: UserCog, sectionPaths: ["/admin/person"] },
      { href: "/admin/sections", label: "Sections", icon: LayoutGrid },
      { href: "/admin/activity", label: "Activity", icon: History },
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
