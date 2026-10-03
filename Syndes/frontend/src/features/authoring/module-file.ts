import type { DraftQuestion, ModuleDraft } from "./draft-types";

/**
 * The unsealed module file the Rust core's `seal_module` accepts
 * (src-tauri/src/model.rs `DraftModule`, shape from docs/module.schema.json).
 * It still carries plaintext answers; only the sealed result may be shared.
 */
export type DraftModuleFile = {
  schema_version: "1.0";
  module: {
    id: string;
    type: "quiz" | "lesson";
    title: string;
    subject?: string;
    grade_level?: string;
  };
  lesson?: { blocks: { kind: "heading" | "paragraph"; text: string }[] };
  quiz?: {
    hash_algo: "SHA-256";
    normalization: "lowercase|trim|collapse-ws|strip-punct";
    questions: {
      id: string;
      kind: DraftQuestion["kind"];
      prompt: string;
      options?: string[];
      answer: string;
      points: number;
    }[];
  };
};

/** Ids are taken from the draft's own ids, so they stay fixed when items are reordered. */
function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 10);
}

export function moduleFileId(draft: ModuleDraft): string {
  return `mod_${shortId(draft.id)}`;
}

function toFileQuestion(question: DraftQuestion) {
  const base = { id: `q_${shortId(question.id)}`, kind: question.kind, prompt: question.prompt.trim(), points: question.points };
  switch (question.kind) {
    case "multiple_choice": {
      const options = question.options.map((option) => option.trim());
      const answer = question.correctIndex === null ? "" : (options[question.correctIndex] ?? "");
      return { ...base, options: options.filter(Boolean), answer };
    }
    case "true_false":
      return { ...base, options: ["True", "False"], answer: question.answer ?? "" };
    case "identification":
      return { ...base, answer: question.answer.trim() };
  }
}

/**
 * Maps a checked draft onto the module file. Each Lesson becomes a heading
 * block followed by its own blocks, because the file has one block list.
 * Summary, outcomes, minutes and Flashcards have no place in the file yet,
 * so they stay in the draft.
 */
export function toDraftModuleFile(draft: ModuleDraft): DraftModuleFile {
  const subject = draft.subject.trim();
  const gradeLevel = draft.gradeLevel.trim();
  const blocks = draft.lessons.flatMap((lesson) => [
    { kind: "heading" as const, text: lesson.title.trim() },
    ...lesson.blocks
      .filter((block) => block.text.trim())
      .map((block) => ({ kind: block.kind, text: block.text.trim() })),
  ]);

  return {
    schema_version: "1.0",
    module: {
      id: moduleFileId(draft),
      type: draft.questions.length > 0 ? "quiz" : "lesson",
      title: draft.title.trim(),
      ...(subject ? { subject } : {}),
      ...(gradeLevel ? { grade_level: gradeLevel } : {}),
    },
    ...(blocks.length > 0 ? { lesson: { blocks } } : {}),
    ...(draft.questions.length > 0
      ? {
          quiz: {
            hash_algo: "SHA-256" as const,
            normalization: "lowercase|trim|collapse-ws|strip-punct" as const,
            questions: draft.questions.map(toFileQuestion),
          },
        }
      : {}),
  };
}
