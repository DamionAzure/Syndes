/**
 * Who is using the app, as the Rust core resolved it (`auth_resolve_role`,
 * src-tauri/src/auth/mod.rs). The webview never decides a role: it only reads
 * the core's answer and fails closed to the Student floor on anything else.
 */

export type Role = "student" | "teacher" | "admin";

/**
 * `demo` comes only from the demo sign-in, which exists in debug builds of the
 * core alone (auth::demo). It is never a verified sign-in.
 */
export type AuthSource = "onlineVerified" | "offlineVerified" | "onlineGate" | "studentReadOnly" | "demo";

export type AuthContext = { role: Role; readOnly: boolean; source: AuthSource };

/** The core's own floor: no verifiable session means Student, read-only. */
export const STUDENT_FLOOR: AuthContext = { role: "student", readOnly: true, source: "studentReadOnly" };

const ROLES: readonly Role[] = ["student", "teacher", "admin"];
const SOURCES: readonly AuthSource[] = ["onlineVerified", "offlineVerified", "onlineGate", "studentReadOnly", "demo"];

/** IPC payloads are untrusted shapes: anything unexpected becomes the Student floor. */
export function parseAuthContext(raw: unknown): AuthContext {
  if (typeof raw !== "object" || raw === null) return STUDENT_FLOOR;
  const record = raw as Record<string, unknown>;
  const role = ROLES.find((candidate) => candidate === record["role"]);
  const source = SOURCES.find((candidate) => candidate === record["source"]);
  const readOnly = record["readOnly"];
  if (!role || !source || typeof readOnly !== "boolean") return STUDENT_FLOOR;
  return { role, readOnly, source };
}

/**
 * Roles are separate, not nested (ADR-0007): Teach is for a verified Teacher,
 * Administration for a verified Administrator. Everyone may use Learn.
 */
export function canTeach(context: AuthContext): boolean {
  return context.role === "teacher" && !context.readOnly;
}

export function canAdminister(context: AuthContext): boolean {
  return context.role === "admin" && !context.readOnly;
}

export const TEACH_PATH = "/teach";

export const ADMIN_PATH = "/admin";

/** Where a Student lands when they try to open a Teacher page. */
export const LEARN_HOME = "/";

function isWithin(pathname: string, base: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return path === base || path.startsWith(`${base}/`);
}

export function isTeachPath(pathname: string): boolean {
  return isWithin(pathname, TEACH_PATH);
}

export function isAdminPath(pathname: string): boolean {
  return isWithin(pathname, ADMIN_PATH);
}
