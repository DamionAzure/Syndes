// Central Tauri command wrapper for the spec-01 boundary commands that have no
// other home. Mirrors the port pattern in lib/access/access-bridge.ts: every
// call guards with isTauri(), invokes with the EXACT registered command name and
// camelCase arg keys (src-tauri/src/lib.rs invoke_handler + commands.rs params),
// then PARSES the untrusted IPC payload before handing it back. Raw IPC errors
// never escape: they are read into the typed AppError shape so callers can branch
// on `kind` (notably "Forbidden" for the RBAC-gated teacher commands).
//
// Deliberately NOT here: load_module (owned by lib/moduleStore.ts),
// auth_resolve_role (owned by lib/access/access-bridge.ts), and
// check_answer/score_submission (owned by the quiz scorer).

import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseAuthContext, type AuthContext, type Role } from "./access/access";
import type { Module } from "./types";

/**
 * The Rust error envelope: `AppError` serializes with serde `tag="kind",
 * content="message"` (src-tauri/src/model.rs), so every rejected command throws
 * an object shaped `{ kind, message }`. Teacher commands may carry
 * `kind: "Forbidden"`; generation may carry `"GenerationError"`; sealing may
 * carry `"ValidationError"`, etc.
 */
export interface AppError {
  kind: string;
  message: string;
}

/**
 * Read any thrown IPC value into the AppError shape without letting a raw error
 * escape the bridge. Unknown shapes degrade to a generic `kind: "Unknown"` with
 * a best-effort message string.
 */
export function readAppError(error: unknown): AppError {
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const kind = record["kind"];
    const message = record["message"];
    if (typeof kind === "string" && typeof message === "string") {
      return { kind, message };
    }
  }
  if (typeof error === "string") return { kind: "Unknown", message: error };
  return { kind: "Unknown", message: "an unexpected error occurred" };
}

/** Raised by the wrappers below when invoked outside a Tauri runtime. */
export class BridgeUnavailableError extends Error {
  constructor(command: string) {
    super(`"${command}" is only available inside the Tauri desktop app`);
    this.name = "BridgeUnavailableError";
  }
}

// --- Backend IPC payload shapes (serde camelCase, src-tauri/src/model.rs) ------
// Named with a `Backend` prefix where a frontend-local type of the same name
// already exists (the quiz port's `ScoreResult`), so the two never collide.

/** `CheckResult` from model.rs — one question's verdict, no plaintext/hash. */
export interface CheckResult {
  questionId: string;
  correct: boolean;
  points: number;
}

/** `ScoreResult` from model.rs — the batched submission verdict. */
export interface BackendScoreResult {
  correctCount: number;
  totalCount: number;
  pointsEarned: number;
  pointsPossible: number;
  perQuestion: CheckResult[];
}

/** `Scaffold` from src-tauri/src/scaffold.rs — one picker entry. */
export interface Scaffold {
  id: string;
  label: string;
  subject: string;
  gradeLevel: string;
  topicHint: string;
  suggestedQuestionCount: number;
  description: string;
}

/** `ScaffoldChoice` from scaffold.rs — the teacher's pick plus overrides. */
export interface ScaffoldChoice {
  scaffoldId: string;
  topic?: string;
  gradeLevel?: string;
  numQuestions?: number;
}

/** `GenerationRequest` from src-tauri/src/groq.rs. */
export interface GenerationRequest {
  topic: string;
  subject?: string;
  gradeLevel?: string;
  sourceText?: string;
  numQuestions?: number;
}

/** `SealedAnswer` from model.rs — the salt + hash for one sealed answer. */
export interface SealedAnswer {
  salt: string;
  answerHash: string;
}

// --- Payload validators --------------------------------------------------------
// IPC payloads are untrusted shapes (docs/standards security-and-privacy): every
// return is narrowed before it leaves the bridge, mirroring parseAuthContext.

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null) return null;
  return raw as Record<string, unknown>;
}

/** Minimal structural guard for a sealed `Module` (object with module.id). */
export function isModule(raw: unknown): raw is Module {
  const record = asRecord(raw);
  if (!record) return false;
  const meta = asRecord(record["module"]);
  return meta !== null && typeof meta["id"] === "string";
}

function parseSealedAnswer(raw: unknown): SealedAnswer {
  const record = asRecord(raw);
  if (!record || typeof record["salt"] !== "string" || typeof record["answerHash"] !== "string") {
    throw new Error("seal_answer returned an unexpected payload");
  }
  return { salt: record["salt"], answerHash: record["answerHash"] };
}

function parseScaffold(raw: unknown): Scaffold {
  const record = asRecord(raw);
  if (
    !record ||
    typeof record["id"] !== "string" ||
    typeof record["label"] !== "string" ||
    typeof record["subject"] !== "string" ||
    typeof record["gradeLevel"] !== "string" ||
    typeof record["topicHint"] !== "string" ||
    typeof record["suggestedQuestionCount"] !== "number" ||
    typeof record["description"] !== "string"
  ) {
    throw new Error("list_scaffolds returned an unexpected scaffold payload");
  }
  return {
    id: record["id"],
    label: record["label"],
    subject: record["subject"],
    gradeLevel: record["gradeLevel"],
    topicHint: record["topicHint"],
    suggestedQuestionCount: record["suggestedQuestionCount"],
    description: record["description"],
  };
}

function parseModule(raw: unknown): Module {
  if (!isModule(raw)) throw new Error("command returned an unexpected module payload");
  return raw;
}

// --- Command wrappers ----------------------------------------------------------
// Single-word Rust params keep their name (`raw`, `request`, `choice`); multi-word
// params arrive as camelCase (`questionId`, `plaintextAnswer`, `accessToken`,
// `jwksUrl`). list_scaffolds / auth_logout take no args.

/** `normalize_answer(raw) -> String` — cosmetic/display normalization only. */
export async function normalizeAnswer(raw: string): Promise<string> {
  if (!isTauri()) throw new BridgeUnavailableError("normalize_answer");
  const result = await invoke<unknown>("normalize_answer", { raw });
  if (typeof result !== "string") throw new Error("normalize_answer returned a non-string payload");
  return result;
}

/** `seal_answer(questionId, plaintextAnswer) -> SealedAnswer`. RBAC-gated. */
export async function sealAnswer(questionId: string, plaintextAnswer: string): Promise<SealedAnswer> {
  if (!isTauri()) throw new BridgeUnavailableError("seal_answer");
  return parseSealedAnswer(await invoke<unknown>("seal_answer", { questionId, plaintextAnswer }));
}

/** `generate_module(request) -> Module`. RBAC-gated; Rust guarantees a fallback. */
export async function generateModule(request: GenerationRequest): Promise<Module> {
  if (!isTauri()) throw new BridgeUnavailableError("generate_module");
  return parseModule(await invoke<unknown>("generate_module", { request }));
}

/** `list_scaffolds() -> Scaffold[]`. RBAC-gated; takes no args. */
export async function listScaffolds(): Promise<Scaffold[]> {
  if (!isTauri()) throw new BridgeUnavailableError("list_scaffolds");
  const result = await invoke<unknown>("list_scaffolds");
  if (!Array.isArray(result)) throw new Error("list_scaffolds returned a non-array payload");
  return result.map(parseScaffold);
}

/** `generate_from_scaffold(choice) -> Module`. RBAC-gated; Rust guarantees a fallback. */
export async function generateFromScaffold(choice: ScaffoldChoice): Promise<Module> {
  if (!isTauri()) throw new BridgeUnavailableError("generate_from_scaffold");
  return parseModule(await invoke<unknown>("generate_from_scaffold", { choice }));
}

/** `auth_online_login(accessToken, jwksUrl) -> AuthContext`. */
export async function authOnlineLogin(accessToken: string, jwksUrl: string): Promise<AuthContext> {
  if (!isTauri()) throw new BridgeUnavailableError("auth_online_login");
  return parseAuthContext(await invoke<unknown>("auth_online_login", { accessToken, jwksUrl }));
}

/** `auth_logout() -> ()`. Takes no args; resolves once the session is cleared. */
export async function authLogout(): Promise<void> {
  if (!isTauri()) throw new BridgeUnavailableError("auth_logout");
  await invoke<unknown>("auth_logout");
}

// --- Demo sign-in (debug builds of the core only) -------------------------------
// Faux sign-in until the real Supabase sign-in screen exists. The core compiles
// it only into debug builds; a release core reports `false` and refuses.

/** `auth_demo_available() -> bool`. False outside Tauri or in a release build. */
export async function demoSignInAvailable(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return (await invoke<unknown>("auth_demo_available")) === true;
  } catch {
    return false;
  }
}

/** `auth_demo_sign_in(role) -> AuthContext`. Debug builds only. */
export async function demoSignIn(role: Role): Promise<AuthContext> {
  if (!isTauri()) throw new BridgeUnavailableError("auth_demo_sign_in");
  return parseAuthContext(await invoke<unknown>("auth_demo_sign_in", { role }));
}

/** `auth_demo_sign_out() -> ()`. Debug builds only. */
export async function demoSignOut(): Promise<void> {
  if (!isTauri()) throw new BridgeUnavailableError("auth_demo_sign_out");
  await invoke<unknown>("auth_demo_sign_out");
}
