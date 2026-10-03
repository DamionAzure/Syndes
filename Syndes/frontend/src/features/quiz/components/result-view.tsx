"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { LoadingState } from "@/components/layout/local-data-boundary";
import { Button, buttonVariants } from "@/components/ui/button";
import { ModuleBreadcrumb } from "@/features/modules/components/module-breadcrumb";
import { ModuleNotFound } from "@/features/modules/components/module-not-found";
import type { Module, Question, Quiz } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";
import { useModuleParam } from "@/features/modules/use-module-param";
import { retryQuiz } from "@/features/progress/progress-store";
import { nowIso, updateProgress, useModuleProgress } from "@/features/progress/use-progress";
import { cn } from "@/lib/utils";
import { useScore, type QuestionStatus } from "../quiz-scorer";
import { NoQuiz } from "./no-quiz";

const STATUS_WORD: Record<QuestionStatus, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Unanswered",
};

export function ResultView() {
  const found = useModuleParam();
  if (!found) return <ModuleNotFound />;
  if (!found.quiz || found.quiz.questions.length === 0) return <NoQuiz found={found} />;
  return <QuizResultGate key={found.id} found={found} quiz={found.quiz} />;
}

function QuizResultGate({ found, quiz }: { found: Module; quiz: Quiz }) {
  const router = useRouter();
  const { progress } = useModuleProgress(found);
  const submitted = progress?.quizSubmitted === true;

  // A Result exists only for a submitted Quiz.
  useEffect(() => {
    if (!submitted) router.replace(routes.quiz(found.id));
  }, [submitted, router, found.id]);

  if (!submitted || !progress) return <LoadingState label="Opening the quiz…" />;
  return <QuizResult found={found} quiz={quiz} answers={progress.answers} />;
}

function answerText(question: Question, answer: string | undefined): string | null {
  if (!answer?.trim()) return null;
  if (question.kind === "text") return answer;
  return question.options.find((option) => option.id === answer)?.label ?? null;
}

function QuizResult({
  found,
  quiz,
  answers,
}: {
  found: Module;
  quiz: Quiz;
  answers: Record<string, string>;
}) {
  const router = useRouter();
  // Rebuilt by scoring the saved answers again; no score is stored.
  const score = useScore(found.id, answers);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function retry() {
    updateProgress((store) => retryQuiz(store, found, nowIso()));
    router.push(routes.quiz(found.id));
  }

  return (
    <div className="mx-auto max-w-[44rem]">
      <ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} current="Quiz result" />

      <div className="border border-border bg-surface p-6 sm:p-10">
        <h1 ref={headingRef} tabIndex={-1} className="text-meta text-muted-foreground">
          Quiz result
        </h1>
        <p className="mt-2 text-title font-semibold tabular-nums">
          {score.correct} of {score.total}
        </p>
        <p className="mt-1 text-muted-foreground">Scored on this device</p>

        <h2 className="mt-10 text-section font-semibold">Your answers</h2>
        <ol className="mt-4 border-t border-border">
          {quiz.questions.map((question, index) => {
            const status =
              score.questions.find((entry) => entry.questionId === question.id)?.status ?? "unanswered";
            const given = answerText(question, answers[question.id]);
            return (
              <li key={question.id} className="grid gap-1 border-b border-border py-4">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-meta text-muted-foreground">Question {index + 1}</span>
                  <span
                    className={cn(
                      "flex items-center gap-2 text-meta font-semibold",
                      status === "correct" && "text-success",
                      status === "incorrect" && "text-destructive",
                      status === "unanswered" && "text-muted-foreground",
                    )}
                  >
                    <span aria-hidden="true" className="size-2 bg-current" />
                    {STATUS_WORD[status]}
                  </span>
                </p>
                <p>{question.prompt}</p>
                <p className="text-meta text-muted-foreground">
                  {given ? `Your answer: ${given}` : "No answer given"}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-10 flex flex-wrap gap-4">
          <Button onClick={retry}>Retry</Button>
          <Link href={routes.lesson(found.id, 1)} className={buttonVariants({ variant: "outline" })}>
            Review lesson
          </Link>
        </div>
      </div>
    </div>
  );
}
