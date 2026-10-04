import type { AccessState } from "./directory-types";

/** Administrator routes. Ids travel in search params (ADR-0001). */
export const adminRoutes = {
  school: () => "/admin",
  people: (access?: AccessState) =>
    access ? `/admin/people?${new URLSearchParams({ access }).toString()}` : "/admin/people",
  person: (accountId: string) => `/admin/person?${new URLSearchParams({ account: accountId }).toString()}`,
  sections: () => "/admin/sections",
  activity: () => "/admin/activity",
};
