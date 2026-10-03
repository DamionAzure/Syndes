"use client";

import { useId, type Ref } from "react";
import { Input } from "@/components/ui/input";
import type { Question } from "@/features/modules/module-types";

export function TextQuestion({
  question,
  answer,
  onAnswer,
  headingRef,
}: {
  question: Extract<Question, { kind: "text" }>;
  answer: string;
  onAnswer: (text: string) => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const inputId = useId();

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="text-page font-semibold">
        <label htmlFor={inputId}>{question.prompt}</label>
      </h2>
      <p className="mt-3 text-meta text-muted-foreground" id={`${inputId}-hint`}>
        Type your answer.
      </p>
      <Input
        id={inputId}
        aria-describedby={`${inputId}-hint`}
        className="mt-4 max-w-[30rem] bg-surface text-body"
        value={answer}
        autoComplete="off"
        onChange={(event) => onAnswer(event.target.value)}
      />
    </div>
  );
}
