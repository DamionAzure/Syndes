/**
 * Who is using the app, as the Rust core resolved it (`auth_resolve_role`,
 * src-tauri/src/auth/mod.rs). The webview never decides a role: it only reads
 * the core's answer and fails closed to the Student floor on anything else.
 */

export type Role = "student" | "teacher" | "admin";

export type AuthSource = "onlineVerified" | "offlineVerified" | "onlineGate" | "studentReadOnly";

export type AuthContext = { role: Role; readOnly: boolean; source: AuthSource };

/** The core's own floor: no verifiable session means Student, read-only. */
export const STUDENT_FLOOR: AuthContext = { role: "student", readOnly: true, source: "studentReadOnly" };

const ROLES: readonly Role[] = ["student", "teacher", "admin"];
const SOURCES: readonly AuthSource[] = ["onlineVerified", "offlineVerified", "onlineGate", "studentReadOnly"];

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

/** Teach is for a verified Teacher or Admin who is not in the read-only floor. */
export function canTeach(context: AuthContext): boolean {
  return (context.role === "teacher" || context.role === "admin") && !context.readOnly;
}

export const TEACH_PATH = "/teach";

/** Where a Student lands when they try to open a Teacher page. */
export const LEARN_HOME = "/";

export function isTeachPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return path === TEACH_PATH || path.startsWith(`${TEACH_PATH}/`);
}
