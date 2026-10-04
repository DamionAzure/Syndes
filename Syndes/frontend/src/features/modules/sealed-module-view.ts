import type { Module as SealedModule, ModuleSummary as PublishedSummary } from "@/lib/types";
import type { Lesson, Module, ModuleSummary, Question } from "./module-types";

function contentVersion(sealed: SealedModule): string {
  const text = JSON.stringify(sealed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return `${sealed.schema_version}-${(hash >>> 0).toString(16)}`;
}

function sections(sealed: SealedModule): Lesson["sections"] {
  const result: Lesson["sections"] = [];
  for (const block of sealed.lesson?.blocks ?? []) {
    if (block.kind === "heading") result.push({ heading: block.text, paragraphs: [] });
    else if (result.length === 0) result.push({ heading: "Read", paragraphs: [block.text] });
    else result[result.length - 1]?.paragraphs.push(block.text);
  }
  return result;
}

function question(item: NonNullable<SealedModule["quiz"]>["questions"][number]): Question {
  if (item.kind === "identification") return { id: item.id, kind: "text", prompt: item.prompt };
  return {
    id: item.id,
    kind: "choice",
    prompt: item.prompt,
    options: (item.options ?? (item.kind === "true_false" ? ["True", "False"] : [])).map((label) => ({ id: label, label })),
  };
}

/** Maps the sealed file contract onto the existing learner screens. */
export function toLearnerModule(sealed: SealedModule): Module {
  const lessonSections = sections(sealed);
  const lessons: Lesson[] = lessonSections.length > 0
    ? [{ id: `${sealed.module.id}-lesson`, title: sealed.module.title, minutes: 5, sections: lessonSections }]
    : [];
  return {
    id: sealed.module.id,
    version: contentVersion(sealed),
    title: sealed.module.title,
    subject: sealed.module.subject ?? "General",
    summary: sealed.module.grade_level ? `Grade ${sealed.module.grade_level}` : "Teacher-prepared module",
    lessonCount: lessons.length,
    questionCount: sealed.quiz?.questions.length ?? 0,
    hasFlashcards: false,
    readyOffline: true,
    outcomes: [],
    lessons,
    ...(sealed.quiz ? { quiz: { questions: sealed.quiz.questions.map(question) } } : {}),
  };
}

export function toPublishedSummary(row: PublishedSummary): ModuleSummary {
  return {
    id: row.id,
    version: row.published_at,
    title: row.title,
    subject: row.subject ?? "General",
    summary: row.grade_level ? `Grade ${row.grade_level}` : "Teacher-prepared module",
    lessonCount: row.type === "lesson" ? 1 : 0,
    questionCount: row.question_count,
    hasFlashcards: false,
    readyOffline: false,
  };
}
