import type { DraftPart, DraftQuestion, ModuleDraft } from "./draft-types";

/** Something to fix before the draft can be sealed, with where to fix it. */
export type DraftIssue = {
  part: DraftPart;
  /** The field to focus when the Teacher follows the issue, when there is one. */
  fieldId?: string;
  message: string;
};

export const fieldIds = {
  title: "draft-title",
  subject: "draft-subject",
  lessonTitle: (lessonId: string) => `lesson-${lessonId}-title`,
  block: (blockId: string) => `block-${blockId}`,
  prompt: (questionId: string) => `question-${questionId}-prompt`,
  options: (questionId: string) => `question-${questionId}-options`,
  answer: (questionId: string) => `question-${questionId}-answer`,
  front: (cardId: string) => `flashcard-${cardId}-front`,
  back: (cardId: string) => `flashcard-${cardId}-back`,
};

/** The same comparison the sealed Quiz uses, so duplicate options are caught here. */
export function normalizeForCompare(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function questionIssues(question: DraftQuestion, number: number): DraftIssue[] {
  const part: DraftPart = { kind: "quiz" };
  const label = `Question ${number}`;
  const issues: DraftIssue[] = [];
  if (!question.prompt.trim()) {
    issues.push({ part, fieldId: fieldIds.prompt(question.id), message: `${label} needs a prompt.` });
  }
  switch (question.kind) {
    case "multiple_choice": {
      const filled = question.options.filter((option) => option.trim());
      if (filled.length < 2) {
        issues.push({ part, fieldId: fieldIds.options(question.id), message: `${label} needs at least two options.` });
      }
      const normalized = filled.map(normalizeForCompare);
      if (new Set(normalized).size !== normalized.length) {
        issues.push({ part, fieldId: fieldIds.options(question.id), message: `${label} has two options that read the same.` });
      }
      const correct = question.correctIndex === null ? undefined : question.options[question.correctIndex];
      if (!correct?.trim()) {
        issues.push({ part, fieldId: fieldIds.answer(question.id), message: `${label} needs a correct option marked.` });
      }
      break;
    }
    case "true_false":
      if (!question.answer) {
        issues.push({ part, fieldId: fieldIds.answer(question.id), message: `${label} needs True or False marked as correct.` });
      }
      break;
    case "identification":
      if (!normalizeForCompare(question.answer)) {
        issues.push({ part, fieldId: fieldIds.answer(question.id), message: `${label} needs an accepted answer.` });
      }
      break;
  }
  return issues;
}

/** Everything that stops the draft from becoming a valid Module file, in editor order. */
export function checkDraft(draft: ModuleDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const details: DraftPart = { kind: "details" };

  if (!draft.title.trim()) issues.push({ part: details, fieldId: fieldIds.title, message: "Give the module a title." });
  if (!draft.subject.trim()) issues.push({ part: details, fieldId: fieldIds.subject, message: "Add the subject." });
  if (draft.lessons.length === 0 && draft.questions.length === 0) {
    issues.push({ part: details, message: "Add a lesson or a quiz question. A module needs at least one." });
  }

  draft.lessons.forEach((lesson, index) => {
    const part: DraftPart = { kind: "lesson", lesson: index + 1 };
    const label = `Lesson ${index + 1}`;
    if (!lesson.title.trim()) {
      issues.push({ part, fieldId: fieldIds.lessonTitle(lesson.id), message: `${label} needs a title.` });
    }
    if (!lesson.blocks.some((block) => block.kind === "paragraph" && block.text.trim())) {
      issues.push({ part, message: `${label} needs at least one paragraph.` });
    }
    const empty = lesson.blocks.find((block) => !block.text.trim());
    if (empty) {
      issues.push({
        part,
        fieldId: fieldIds.block(empty.id),
        message: `${label} has an empty ${empty.kind}. Fill it in or remove it.`,
      });
    }
  });

  draft.questions.forEach((question, index) => issues.push(...questionIssues(question, index + 1)));

  draft.flashcards.forEach((card, index) => {
    const part: DraftPart = { kind: "flashcards" };
    if (!card.front.trim() || !card.back.trim()) {
      issues.push({
        part,
        fieldId: card.front.trim() ? fieldIds.back(card.id) : fieldIds.front(card.id),
        message: `Flashcard ${index + 1} needs both a front and a back.`,
      });
    }
  });

  return issues;
}
