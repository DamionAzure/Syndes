"use client";

import type { ReactNode } from "react";
import { canAdminister } from "@/lib/access/access";
import { RoleGuard } from "./role-guard";

/** Administration pages require current Administrator authority (ADR-0004). */
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
