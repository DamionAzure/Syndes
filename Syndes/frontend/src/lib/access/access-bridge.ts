import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseAuthContext, STUDENT_FLOOR, type AuthContext } from "./access";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmenting Node's env typing
  namespace NodeJS {
    interface ProcessEnv {
      /** Development only: "teacher" or "admin" to open Teacher pages in a plain browser. */
      readonly NEXT_PUBLIC_SYNDES_DEV_ROLE?: string;
    }
  }
}

/**
 * Plain `next dev` in a browser has no Rust core, so nobody could open the
 * Teacher pages while building them. In development only, and only outside
 * Tauri, NEXT_PUBLIC_SYNDES_DEV_ROLE=teacher stands in for a verified
 * Teacher. `next build` sets NODE_ENV to production, so a shipped build never
 * reads it.
 */
function developmentRole(): AuthContext | null {
  if (process.env.NODE_ENV !== "development") return null;
  // Dot access is required: Next inlines NEXT_PUBLIC_ variables only in this form.
  const role = process.env.NEXT_PUBLIC_SYNDES_DEV_ROLE;
  if (role !== "teacher" && role !== "admin") return null;
  // This local-only preview marker opens Teacher pages. Native sealing and
  // Supabase publishing still require a real signed-in Account.
  return { accountId: "development-account", active: true, role, approved: true, readOnly: false, source: "onlineGate" };
}

/**
 * Asks the Rust core who is using the app. `requirePrivileged` is true when
 * the caller is about to show or do something teacher-only, so the core can
 * apply its stricter path. Any failure (no Tauri runtime, unmanaged auth
 * state, an unexpected payload) resolves to the Student floor, never upward.
 */
export async function resolveAccess(requirePrivileged: boolean): Promise<AuthContext> {
  if (!isTauri()) return developmentRole() ?? STUDENT_FLOOR;
  try {
    return parseAuthContext(await invoke<unknown>("auth_resolve_role", { requirePrivileged }));
  } catch {
    return STUDENT_FLOOR;
  }
}
