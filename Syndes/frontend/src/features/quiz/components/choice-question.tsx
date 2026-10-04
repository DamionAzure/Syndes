"use client";

import { useId, type Ref } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Question } from "@/features/modules/module-types";

type ChoiceQuestionProps = {
  question: Extract<Question, { kind: "choice" }>;
  answer: string;
  onAnswer: (optionId: string) => void;
  headingRef?: Ref<HTMLHeadingElement>;
};

/** The whole answer row is clickable; the checked row gets a 2px primary border and quiet fill. */
export function ChoiceQuestion({ question, answer, onAnswer, headingRef }: ChoiceQuestionProps) {
  const baseId = useId();
  const headingId = `${baseId}-prompt`;

  return (
    <div>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-section font-semibold text-balance sm:text-page">
        {question.prompt}
      </h2>
      <RadioGroup
        aria-labelledby={headingId}
        value={answer === "" ? null : answer}
        onValueChange={(value) => onAnswer(String(value))}
        className="mt-8 gap-3"
      >
        {question.options.map((option) => {
          const optionId = `${baseId}-${option.id}`;
          return (
            <FieldLabel
              key={option.id}
              htmlFor={optionId}
              className="w-full cursor-pointer rounded-md border-2 border-border bg-surface transition-colors hover:border-primary/50 has-data-checked:border-primary has-data-checked:bg-surface-muted dark:has-data-checked:border-primary dark:has-data-checked:bg-surface-muted"
            >
              <Field orientation="horizontal" className="min-h-(--control-height) items-center gap-4 px-4">
                <RadioGroupItem value={option.id} id={optionId} />
                <span className="text-body font-normal">{option.label}</span>
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
    </div>
  );
}
