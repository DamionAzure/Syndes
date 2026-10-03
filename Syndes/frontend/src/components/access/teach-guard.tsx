"use client";

import type { ReactNode } from "react";
import { canTeach } from "@/lib/access/access";
import { RoleGuard } from "./role-guard";

/** Teacher pages, for a verified Teacher only (ADR-0006, ADR-0007). */
export function TeachGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={canTeach} deniedLabel="Teacher pages are for teachers only. Taking you to Home…">
      {children}
    </RoleGuard>
  );
}
