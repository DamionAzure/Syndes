// Boundary types for the online module store (spec: supabase-database, Req 1.5, 3.5).
//
// `Module` is the SEALED contract shape (spec 00): every question carries only
// `salt` + `answer_hash`. There is DELIBERATELY no plaintext `answer` field on
// SealedQuestion — a DraftModule (which carries plaintext) is a different type
// that lives only in the teacher-side seal step and must never reach the store.
// This is the client-side half of the "no plaintext" guarantee (Correctness
// Property 7 / Property 8); the server trigger (migration 0002) is the backstop.

export type QuestionKind = "multiple_choice" | "identification" | "true_false";

export type BlockKind = "heading" | "paragraph";

export interface LessonBlock {
  kind: BlockKind;
  text: string;
}

export interface SealedQuestion {
  id: string;
  kind: QuestionKind;
  prompt: string;
  /** MC/TF only: the displayed option text (also what gets hashed). */
  options?: string[];
  /** Sealed — present on every question. */
  salt: string;
  /** Sealed — present on every question. SHA-256(id : normalize(answer) : salt). */
  answer_hash: string;
  points: number;
  // NOTE: no `answer` / plaintext field exists on this type, by design.
}

/** The sealed, contract-valid module — the only shape the store accepts. */
export interface Module {
  schema_version: "1.0";
  module: {
    id: string;
    type: "quiz" | "lesson";
    title: string;
    subject?: string;
    grade_level?: string;
  };
  lesson?: { blocks: LessonBlock[] };
  quiz?: {
    hash_algo: "SHA-256";
    normalization: "lowercase|trim|collapse-ws|strip-punct";
    questions: SealedQuestion[];
  };
}

/** Lightweight browse record (Req 5.2) — never requires downloading full JSON. */
export interface ModuleSummary {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  type: "quiz" | "lesson";
  question_count: number;
  published_at: string; // = created_at
}

/** Optional browse filters (Req 5.3-5.5). */
export interface ListFilter {
  subject?: string;
  grade_level?: string;
  /** Title contains (case-insensitive). */
  search?: string;
}
