"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fieldIds } from "../draft-checks";
import { convertQuestion, removeAt, replaceAt } from "../draft-store";
import type { DraftQuestion, QuestionKind, TrueFalse } from "../draft-types";
import { ItemControls, wholeNumber } from "./item-controls";

const KINDS: { value: QuestionKind; label: string }[] = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "true_false", label: "True or false" },
  { value: "identification", label: "Identification" },
];

const MAX_OPTIONS = 6;

const choiceRow =
  "flex min-h-(--control-height) items-center gap-3 rounded-md border-2 border-border bg-surface px-3 has-data-checked:border-primary has-data-checked:bg-surface-muted";

export function QuestionEditor({
  question,
  number,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  question: DraftQuestion;
  number: number;
  total: number;
  onChange: (next: DraftQuestion) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const label = `Question ${number}`;
  const legendId = `question-${question.id}-legend`;

  return (
    <fieldset aria-labelledby={legendId} className="grid gap-5 rounded-xl border border-border p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 id={legendId} className="font-semibold">
          {label}
        </h3>
        <ItemControls itemLabel={label.toLowerCase()} index={number - 1} total={total} onMove={onMove} onRemove={onRemove} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <Field>
          <FieldLabel htmlFor={`question-${question.id}-kind`}>Answer type</FieldLabel>
          <Select
            items={KINDS}
            value={question.kind}
            onValueChange={(value) => {
              const kind = KINDS.find((item) => item.value === value)?.value;
              if (kind) onChange(convertQuestion(question, kind));
            }}
          >
            <SelectTrigger id={`question-${question.id}-kind`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`question-${question.id}-points`}>Points</FieldLabel>
          <Input
            id={`question-${question.id}-points`}
            type="number"
            inputMode="numeric"
            min={0}
            value={question.points}
            onChange={(event) => onChange({ ...question, points: wholeNumber(event.target.value, question.points) })}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor={fieldIds.prompt(question.id)}>Prompt</FieldLabel>
        <Textarea
          id={fieldIds.prompt(question.id)}
          value={question.prompt}
          className="min-h-16"
          onChange={(event) => onChange({ ...question, prompt: event.target.value })}
        />
      </Field>

      <AnswerEditor question={question} onChange={onChange} />
    </fieldset>
  );
}

function AnswerEditor({ question, onChange }: { question: DraftQuestion; onChange: (next: DraftQuestion) => void }) {
  const hintId = `question-${question.id}-answer-hint`;
  const hint = (
    <FieldDescription id={hintId}>
      Only you see the correct answer. The sealed file Learners get checks answers without listing them.
    </FieldDescription>
  );

  switch (question.kind) {
    case "multiple_choice": {
      const groupId = `question-${question.id}-options-label`;
      return (
        <div className="grid gap-3">
          <p id={groupId} className="font-medium">
            Options, with the correct one marked
          </p>
          <RadioGroup
            aria-labelledby={groupId}
            aria-describedby={hintId}
            value={question.correctIndex === null ? null : String(question.correctIndex)}
            onValueChange={(value) => onChange({ ...question, correctIndex: Number(value) })}
            className="gap-2"
          >
            {question.options.map((option, index) => (
              <div key={index} className={choiceRow}>
                <RadioGroupItem
                  value={String(index)}
                  id={index === 0 ? fieldIds.answer(question.id) : undefined}
                  aria-label={`Option ${index + 1} is correct`}
                />
                <Input
                  id={index === 0 ? fieldIds.options(question.id) : undefined}
                  aria-label={`Option ${index + 1}`}
                  value={option}
                  className="border-0 bg-transparent px-1 dark:bg-transparent"
                  onChange={(event) =>
                    onChange({ ...question, options: replaceAt(question.options, index, event.target.value) })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove option ${index + 1}`}
                  disabled={question.options.length <= 2}
                  onClick={() => {
                    const correct = question.correctIndex;
                    onChange({
                      ...question,
                      options: removeAt(question.options, index),
                      correctIndex:
                        correct === null || correct === index ? null : correct > index ? correct - 1 : correct,
                    });
                  }}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ))}
          </RadioGroup>
          {question.options.length < MAX_OPTIONS ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => onChange({ ...question, options: [...question.options, ""] })}
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              Add option
            </Button>
          ) : null}
          {hint}
        </div>
      );
    }
    case "true_false": {
      const groupId = `question-${question.id}-tf-label`;
      return (
        <div className="grid gap-3">
          <p id={groupId} className="font-medium">
            Correct answer
          </p>
          <RadioGroup
            aria-labelledby={groupId}
            aria-describedby={hintId}
            value={question.answer}
            onValueChange={(value) => {
              const answer: TrueFalse | null = value === "True" || value === "False" ? value : null;
              onChange({ ...question, answer });
            }}
            className="grid-cols-2 gap-2"
          >
            {(["True", "False"] as const).map((choice) => {
              const id = choice === "True" ? fieldIds.answer(question.id) : `question-${question.id}-false`;
              return (
                <label key={choice} htmlFor={id} className={`${choiceRow} cursor-pointer`}>
                  <RadioGroupItem value={choice} id={id} />
                  {choice}
                </label>
              );
            })}
          </RadioGroup>
          {hint}
        </div>
      );
    }
    case "identification":
      return (
        <Field>
          <FieldLabel htmlFor={fieldIds.answer(question.id)}>Accepted answer</FieldLabel>
          <Input
            id={fieldIds.answer(question.id)}
            value={question.answer}
            aria-describedby={hintId}
            onChange={(event) => onChange({ ...question, answer: event.target.value })}
          />
          <FieldDescription id={hintId}>
            Matching ignores capital letters, extra spaces and punctuation. Only you see this answer.
          </FieldDescription>
        </Field>
      );
  }
}
