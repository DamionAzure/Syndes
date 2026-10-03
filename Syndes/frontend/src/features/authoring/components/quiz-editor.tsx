"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldIds } from "../draft-checks";
import { move, newQuestion, removeAt, replaceAt } from "../draft-store";
import type { DraftQuestion, ModuleDraft } from "../draft-types";
import type { EditDraft } from "./item-controls";
import { QuestionEditor } from "./question-editor";

export function QuizEditor({
  draft,
  edit,
  headingId,
}: {
  draft: ModuleDraft;
  edit: EditDraft;
  headingId: string;
}) {
  function editQuestions(change: (questions: DraftQuestion[]) => DraftQuestion[]) {
    edit((current) => ({ ...current, questions: change(current.questions) }));
  }

  function addQuestion() {
    const question = newQuestion();
    editQuestions((questions) => [...questions, question]);
    window.setTimeout(() => document.getElementById(fieldIds.prompt(question.id))?.focus(), 0);
  }

  const total = draft.questions.length;
  const points = draft.questions.reduce((sum, question) => sum + question.points, 0);

  return (
    <div className="grid gap-6">
      <p className="text-muted-foreground">
        {total === 0
          ? "Learners answer one question at a time after the last lesson. Keep it short: three to ten questions."
          : `${total} ${total === 1 ? "question" : "questions"}, ${points} ${points === 1 ? "point" : "points"} in all.`}
      </p>
      <ol className="grid gap-5">
        {draft.questions.map((question, index) => (
          <li key={question.id}>
            <QuestionEditor
              question={question}
              number={index + 1}
              total={total}
              onChange={(next) => editQuestions((questions) => replaceAt(questions, index, next))}
              onMove={(delta) => editQuestions((questions) => move(questions, index, delta))}
              onRemove={() => {
                editQuestions((questions) => removeAt(questions, index));
                window.setTimeout(() => document.getElementById(headingId)?.focus(), 0);
              }}
            />
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" onClick={addQuestion} className="justify-self-start">
        <Plus aria-hidden="true" data-icon="inline-start" />
        Add question
      </Button>
    </div>
  );
}
