"use client";

import type { ReactNode } from "react";
import { canAdminister } from "@/lib/access/access";
import { RoleGuard } from "./role-guard";

/** Administration pages, for a verified Administrator only (ADR-0007). */
export function AdminGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard
      allow={canAdminister}
      deniedLabel="Administration is for school administrators only. Taking you to Home…"
    >
      {children}
    </RoleGuard>
  );
}
