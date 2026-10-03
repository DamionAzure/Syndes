import { useSyncExternalStore } from "react";
import { createStoredValue } from "@/lib/local-json-storage";
import type { ActionContext, ActionResult } from "./directory-actions";
import type {
  Account,
  ActivityEntry,
  Directory,
  Enrollment,
  SchoolClass,
  Section,
  TeacherAssignment,
} from "./directory-types";
import { SAMPLE_ADMIN_ID, sampleDirectory } from "./fixture-directory";

/**
 * The sample Directory, with the Administrator's changes kept on this device
 * so the screens can be tried end to end. In production this is replaced by
 * the Supabase directory: reads through RLS, changes through the admin-only
 * functions in migration 0004, which re-check the caller's role (ADR-0007).
 */
export const DIRECTORY_KEY = "syndes:directory-sample:v1";

type Check = Record<string, "string" | "nullable-string">;

function matches(raw: unknown, check: Check): boolean {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const record = raw as Record<string, unknown>;
  return Object.entries(check).every(([key, kind]) => {
    const value = record[key];
    return kind === "string" ? typeof value === "string" : value === null || typeof value === "string";
  });
}

function listOf<T>(raw: unknown, check: Check, extra: (item: Record<string, unknown>) => boolean = () => true): T[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.every((item) => matches(item, check) && extra(item as Record<string, unknown>)) ? (raw as T[]) : null;
}

const ROLES = ["student", "teacher", "admin"];
const STATUSES = ["active", "removed"];
const ENROLLMENT_STATUSES = ["enrolled", "moved", "dropped", "transferred"];

/** Stored data is untrusted: anything that does not fully match starts again from the sample. */
export function parseDirectory(raw: unknown): Directory {
  if (typeof raw !== "object" || raw === null || (raw as Record<string, unknown>)["schema"] !== 1) {
    return sampleDirectory();
  }
  const record = raw as Record<string, unknown>;
  const accounts = listOf<Account>(
    record["accounts"],
    { id: "string", givenName: "string", familyName: "string", email: "string", lrn: "nullable-string", joinedAt: "string" },
    (item) => ROLES.includes(item["role"] as string) && STATUSES.includes(item["status"] as string),
  );
  const sections = listOf<Section>(record["sections"], { id: "string", gradeLevel: "string", name: "string" });
  const classes = listOf<SchoolClass>(record["classes"], { id: "string", sectionId: "string", learningArea: "string" });
  const assignments = listOf<TeacherAssignment>(record["assignments"], {
    id: "string",
    classId: "string",
    teacherId: "string",
    startedAt: "string",
    endedAt: "nullable-string",
  });
  const enrollments = listOf<Enrollment>(
    record["enrollments"],
    { id: "string", learnerId: "string", sectionId: "string", startedAt: "string", endedAt: "nullable-string" },
    (item) => ENROLLMENT_STATUSES.includes(item["status"] as string),
  );
  const activity = listOf<ActivityEntry>(record["activity"], {
    id: "string",
    at: "string",
    actorId: "string",
    action: "string",
    subjectId: "string",
    summary: "string",
  });
  if (!accounts || !sections || !classes || !assignments || !enrollments || !activity) return sampleDirectory();
  return { schema: 1, accounts, sections, classes, assignments, enrollments, activity };
}

const SAMPLE = sampleDirectory();

const directoryValue = createStoredValue(DIRECTORY_KEY, parseDirectory, SAMPLE);

/** The Directory as the signed-in Administrator sees it. */
export function useDirectory(): Directory {
  return useSyncExternalStore(directoryValue.subscribe, directoryValue.get, directoryValue.getServerSnapshot);
}

/** The Administrator making changes. Supabase uses `auth.uid()` for this. */
export function currentAdministratorId(): string {
  return SAMPLE_ADMIN_ID;
}

/** Runs one change; the Directory is saved only when the change is allowed. */
export function runDirectoryAction(action: (directory: Directory, context: ActionContext) => ActionResult): ActionResult {
  const context: ActionContext = {
    actorId: currentAdministratorId(),
    now: new Date().toISOString(),
    newId: () => globalThis.crypto.randomUUID(),
  };
  const result = action(directoryValue.get(), context);
  if (result.ok) directoryValue.set(result.directory);
  return result;
}

/** Puts the sample school back the way it started. */
export function resetSampleDirectory(): void {
  directoryValue.set(sampleDirectory());
}
