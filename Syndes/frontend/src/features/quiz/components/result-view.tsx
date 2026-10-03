"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { useEffect } from "react";
import { LoadingState } from "@/components/layout/local-data-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ModuleBreadcrumb } from "@/features/modules/components/module-breadcrumb";
import { ModuleNotFound } from "@/features/modules/components/module-not-found";
import { VersionResetNotice } from "@/features/modules/components/version-reset-notice";
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

// Colour only reinforces the status word next to it.
const STATUS_DOT: Record<QuestionStatus, string> = {
  correct: "bg-success",
  incorrect: "bg-destructive",
  unanswered: "border border-muted-foreground",
};

const STATUS_CHIP: Record<QuestionStatus, string> = {
  correct: "bg-success/10 text-success",
  incorrect: "bg-destructive/10 text-destructive",
  unanswered: "bg-surface-muted text-muted-foreground",
};

const RESULT_HEADING_ID = "quiz-result-heading";

export function ResultView() {
  const found = useModuleParam();
  if (!found) return <ModuleNotFound />;
  if (!found.quiz || found.quiz.questions.length === 0) return <NoQuiz found={found} />;
  return <QuizResultGate key={found.id} found={found} quiz={found.quiz} />;
}

function QuizResultGate({ found, quiz }: { found: Module; quiz: Quiz }) {
  const router = useRouter();
  const { progress, versionReset } = useModuleProgress(found);
  const submitted = progress?.quizSubmitted === true;

  // A Result exists only for a submitted Quiz. After a content update the
  // notice is shown here instead, since redirecting would lose it.
  useEffect(() => {
    if (!submitted && !versionReset) router.replace(routes.quiz(found.id));
  }, [submitted, versionReset, router, found.id]);

  if (versionReset && !submitted) {
    return (
      <>
        <PageHeader
          icon={ListChecks}
          context={<ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} current="Quiz result" />}
          title="Quiz result"
          description={found.title}
          actions={
            <Link href={routes.quiz(found.id)} className={buttonVariants()}>
              Start short quiz
            </Link>
          }
        />
        <VersionResetNotice />
      </>
    );
  }
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

  useEffect(() => {
    document.getElementById(RESULT_HEADING_ID)?.focus();
  }, []);

  function retry() {
    updateProgress((store) => retryQuiz(store, found, nowIso()));
    router.push(routes.quiz(found.id));
  }

  const statusOf = (questionId: string): QuestionStatus =>
    score.questions.find((entry) => entry.questionId === questionId)?.status ?? "unanswered";
  const counts = (["correct", "incorrect", "unanswered"] as const).map((status) => ({
    status,
    count: quiz.questions.filter((question) => statusOf(question.id) === status).length,
  }));

  return (
    <>
      <PageHeader
        id={RESULT_HEADING_ID}
        icon={ListChecks}
        context={<ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} current="Quiz result" />}
        title="Quiz result"
        description={found.title}
        actions={
          <>
            <Link href={routes.lesson(found.id, 1)} className={buttonVariants({ variant: "outline" })}>
              Review lesson
            </Link>
            <Button onClick={retry}>Retry</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <section
          aria-labelledby="score-heading"
          className="rounded-xl border border-border bg-surface p-6 lg:sticky lg:top-8"
        >
          <h2 id="score-heading" className="text-meta text-muted-foreground">
            Your score
          </h2>
          <p className="mt-1 text-title leading-none font-semibold tabular-nums">
            {score.correct} of {score.total}
          </p>
          <p className="mt-2 text-muted-foreground">Scored on this device</p>
          <dl className="mt-6 grid gap-2 border-t border-border pt-4 text-meta">
            {counts.map(({ status, count }) => (
              <div key={status} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2">
                  <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOT[status])} />
                  {STATUS_WORD[status]}
                </dt>
                <dd className="font-semibold tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="answers-heading" className="overflow-hidden rounded-xl border border-border bg-surface">
          <h2 id="answers-heading" className="border-b border-border px-6 py-5 text-section font-semibold">
            Your answers
          </h2>
          <ol className="divide-y divide-border">
            {quiz.questions.map((question, index) => {
              const status = statusOf(question.id);
              const given = answerText(question, answers[question.id]);
              return (
                <li key={question.id} className="grid gap-2 px-6 py-5">
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-meta text-muted-foreground">Question {index + 1}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-meta font-semibold",
                        STATUS_CHIP[status],
                      )}
                    >
                      <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOT[status])} />
                      {STATUS_WORD[status]}
                    </span>
                  </p>
                  <p className="font-medium">{question.prompt}</p>
                  <p className="text-meta text-muted-foreground">
                    {given ? `Your answer: ${given}` : "No answer given"}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </>
  );
}
