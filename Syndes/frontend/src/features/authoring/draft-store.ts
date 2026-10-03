import type {
  DraftBlock,
  DraftFlashcard,
  DraftLesson,
  DraftPart,
  DraftQuestion,
  DraftStart,
  DraftStore,
  ModuleDraft,
  QuestionKind,
} from "./draft-types";

export const DRAFTS_KEY = "syndes:teacher-drafts:v1";

export const EMPTY_DRAFTS: DraftStore = { schema: 1, drafts: {} };

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

// --- Parsing: stored drafts are untrusted; anything malformed is dropped. ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function parseList<T>(raw: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const items: T[] = [];
  for (const item of raw) {
    const parsed = parse(item);
    if (parsed === null) return null;
    items.push(parsed);
  }
  return items;
}

function parseBlock(raw: unknown): DraftBlock | null {
  if (!isRecord(raw) || !isString(raw["id"]) || !isString(raw["text"])) return null;
  const kind = raw["kind"];
  if (kind !== "heading" && kind !== "paragraph") return null;
  return { id: raw["id"], kind, text: raw["text"] };
}

function parseLesson(raw: unknown): DraftLesson | null {
  if (!isRecord(raw) || !isString(raw["id"]) || !isString(raw["title"]) || !isCount(raw["minutes"])) {
    return null;
  }
  const blocks = parseList(raw["blocks"], parseBlock);
  return blocks ? { id: raw["id"], title: raw["title"], minutes: raw["minutes"], blocks } : null;
}

function parseQuestion(raw: unknown): DraftQuestion | null {
  if (!isRecord(raw) || !isString(raw["id"]) || !isString(raw["prompt"]) || !isCount(raw["points"])) {
    return null;
  }
  const { id, prompt, points } = { id: raw["id"], prompt: raw["prompt"], points: raw["points"] };
  switch (raw["kind"]) {
    case "multiple_choice": {
      const options = parseList(raw["options"], (option) => (isString(option) ? option : null));
      const correctIndex = raw["correctIndex"];
      if (!options || !(correctIndex === null || isCount(correctIndex))) return null;
      return { id, kind: "multiple_choice", prompt, options, correctIndex, points };
    }
    case "true_false": {
      const answer = raw["answer"];
      if (answer !== null && answer !== "True" && answer !== "False") return null;
      return { id, kind: "true_false", prompt, answer, points };
    }
    case "identification":
      return isString(raw["answer"])
        ? { id, kind: "identification", prompt, answer: raw["answer"], points }
        : null;
    default:
      return null;
  }
}

function parseFlashcard(raw: unknown): DraftFlashcard | null {
  if (!isRecord(raw) || !isString(raw["id"]) || !isString(raw["front"]) || !isString(raw["back"])) {
    return null;
  }
  return { id: raw["id"], front: raw["front"], back: raw["back"] };
}

const STARTS: readonly DraftStart[] = ["module", "quiz", "flashcards"];

function parseDraft(raw: unknown): ModuleDraft | null {
  if (!isRecord(raw)) return null;
  const text = ["id", "title", "subject", "gradeLevel", "summary", "outcomes", "createdAt", "updatedAt"] as const;
  if (!text.every((key) => isString(raw[key]))) return null;
  const start = STARTS.find((candidate) => candidate === raw["start"]);
  const lessons = parseList(raw["lessons"], parseLesson);
  const questions = parseList(raw["questions"], parseQuestion);
  const flashcards = parseList(raw["flashcards"], parseFlashcard);
  if (!start || !lessons || !questions || !flashcards) return null;
  return {
    id: raw["id"] as string,
    start,
    title: raw["title"] as string,
    subject: raw["subject"] as string,
    gradeLevel: raw["gradeLevel"] as string,
    summary: raw["summary"] as string,
    outcomes: raw["outcomes"] as string,
    lessons,
    questions,
    flashcards,
    createdAt: raw["createdAt"] as string,
    updatedAt: raw["updatedAt"] as string,
  };
}

export function parseDraftStore(raw: unknown): DraftStore {
  if (!isRecord(raw) || raw["schema"] !== 1 || !isRecord(raw["drafts"])) return EMPTY_DRAFTS;
  const drafts: Record<string, ModuleDraft> = {};
  for (const [key, value] of Object.entries(raw["drafts"])) {
    const draft = parseDraft(value);
    if (draft && draft.id === key) drafts[key] = draft;
  }
  return { schema: 1, drafts };
}

// --- Building blocks ---

export function newBlock(kind: DraftBlock["kind"]): DraftBlock {
  return { id: newId(), kind, text: "" };
}

export function newLesson(): DraftLesson {
  return { id: newId(), title: "", minutes: 5, blocks: [newBlock("paragraph")] };
}

export function newQuestion(kind: QuestionKind = "multiple_choice"): DraftQuestion {
  const base = { id: newId(), prompt: "", points: 1 };
  switch (kind) {
    case "multiple_choice":
      return { ...base, kind, options: ["", "", "", ""], correctIndex: null };
    case "true_false":
      return { ...base, kind, answer: null };
    case "identification":
      return { ...base, kind, answer: "" };
  }
}

export function newFlashcard(): DraftFlashcard {
  return { id: newId(), front: "", back: "" };
}

/** Changing a Question's kind keeps its id, prompt and points; the answer starts over. */
export function convertQuestion(question: DraftQuestion, kind: QuestionKind): DraftQuestion {
  if (question.kind === kind) return question;
  return { ...newQuestion(kind), id: question.id, prompt: question.prompt, points: question.points };
}

export function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((current, position) => (position === index ? item : current));
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, position) => position !== index);
}

/** Moves one item up (-1) or down (+1); out-of-range moves leave the list as it is. */
export function move<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as T);
  return next;
}

// --- Store changes ---

export function createDraft(store: DraftStore, start: DraftStart, id: string, now: string): DraftStore {
  const draft: ModuleDraft = {
    id,
    start,
    title: "",
    subject: "",
    gradeLevel: "",
    summary: "",
    outcomes: "",
    lessons: start === "module" ? [newLesson()] : [],
    questions: start === "quiz" ? [newQuestion()] : [],
    flashcards: start === "flashcards" ? [newFlashcard()] : [],
    createdAt: now,
    updatedAt: now,
  };
  return { schema: 1, drafts: { ...store.drafts, [id]: draft } };
}

export function updateDraft(
  store: DraftStore,
  id: string,
  change: (draft: ModuleDraft) => ModuleDraft,
  now: string,
): DraftStore {
  const current = store.drafts[id];
  if (!current) return store;
  return { schema: 1, drafts: { ...store.drafts, [id]: { ...change(current), id, updatedAt: now } } };
}

export function deleteDraft(store: DraftStore, id: string): DraftStore {
  const drafts = { ...store.drafts };
  delete drafts[id];
  return { schema: 1, drafts };
}

/** Most recently edited first. */
export function listDrafts(store: DraftStore): ModuleDraft[] {
  return Object.values(store.drafts).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** The part a new draft opens on, matching what the Teacher chose to create. */
export function startingPart(draft: Pick<ModuleDraft, "start">): DraftPart {
  if (draft.start === "quiz") return { kind: "quiz" };
  if (draft.start === "flashcards") return { kind: "flashcards" };
  return { kind: "details" };
}

export function partKey(part: DraftPart): string {
  return part.kind === "lesson" ? `lesson-${part.lesson}` : part.kind;
}

/** Reads `?part=`; unknown or out-of-range values fall back to Details. */
export function parsePart(raw: string | null, draft: ModuleDraft): DraftPart {
  if (raw === "quiz" || raw === "flashcards" || raw === "details") return { kind: raw };
  const match = raw ? /^lesson-(\d+)$/.exec(raw) : null;
  const lesson = match ? Number(match[1]) : 0;
  return lesson >= 1 && lesson <= draft.lessons.length ? { kind: "lesson", lesson } : { kind: "details" };
}

export function draftTitle(draft: ModuleDraft): string {
  return draft.title.trim() || "Untitled module";
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "2 lessons, 5 questions, 8 flashcards"; parts with nothing in them are left out. */
export function draftContents(draft: ModuleDraft): string {
  const parts = [
    draft.lessons.length ? count(draft.lessons.length, "lesson", "lessons") : null,
    draft.questions.length ? count(draft.questions.length, "question", "questions") : null,
    draft.flashcards.length ? count(draft.flashcards.length, "flashcard", "flashcards") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Nothing added yet";
}

export function savedAtLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
