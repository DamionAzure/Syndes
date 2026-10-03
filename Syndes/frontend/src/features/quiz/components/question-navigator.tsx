import { Check } from "lucide-react";
import type { Question } from "@/features/modules/module-types";
import { cn } from "@/lib/utils";
import { isAnswered } from "../quiz-session";

/**
 * Every Question at a glance, with its answered state in words. Lets the
 * Learner jump straight to one they skipped.
 */
export function QuestionNavigator({
  questions,
  answers,
  current,
  onGoTo,
}: {
  questions: readonly Question[];
  answers: Readonly<Record<string, string>>;
  current: number;
  onGoTo: (question: number) => void;
}) {
  const answeredCount = questions.filter((question) => isAnswered(answers[question.id])).length;

  return (
    <nav aria-labelledby="question-nav-heading" className="rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-8">
      <h2 id="question-nav-heading" className="text-body font-semibold">
        Questions
      </h2>
      <p className="text-meta text-muted-foreground">
        {answeredCount} of {questions.length} answered
      </p>
      <ol className="mt-4 grid gap-1">
        {questions.map((question, index) => {
          const number = index + 1;
          const answered = isAnswered(answers[question.id]);
          const isCurrent = number === current;
          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onGoTo(number)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "grid min-h-(--control-height) w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 text-left text-meta hover:bg-surface-muted",
                  isCurrent && "bg-surface-muted font-semibold",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 place-content-center rounded-md border border-border tabular-nums",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {number}
                </span>
                <span>Question {number}</span>
                <span className={cn("flex items-center gap-1", answered ? "text-foreground" : "text-muted-foreground")}>
                  {answered ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
                  {answered ? "Answered" : "Not answered"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
