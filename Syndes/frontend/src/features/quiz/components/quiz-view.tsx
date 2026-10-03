"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoadingState } from "@/components/layout/local-data-boundary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/ui/step-progress";
import { ModuleBreadcrumb } from "@/features/modules/components/module-breadcrumb";
import { ModuleNotFound } from "@/features/modules/components/module-not-found";
import { VersionResetNotice } from "@/features/modules/components/version-reset-notice";
import type { Module, Quiz } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";
import { useModuleParam } from "@/features/modules/use-module-param";
import { markQuizSubmitted, recordAnswer, recordStep } from "@/features/progress/progress-store";
import { nowIso, updateProgress, useModuleProgress } from "@/features/progress/use-progress";
import { useQuizScorer } from "../quiz-scorer";
import { quizNavigation, startingQuestion, unansweredQuestions } from "../quiz-session";
import { ChoiceQuestion } from "./choice-question";
import { NoQuiz } from "./no-quiz";
import { TextQuestion } from "./text-question";
import { UnansweredSummary } from "./unanswered-summary";

export function QuizView() {
  const found = useModuleParam();
  if (!found) return <ModuleNotFound />;
  if (!found.quiz || found.quiz.questions.length === 0) return <NoQuiz found={found} />;
  return <QuizSession key={found.id} found={found} quiz={found.quiz} />;
}

function QuizSession({ found, quiz }: { found: Module; quiz: Quiz }) {
  const router = useRouter();
  const scorer = useQuizScorer();
  const { progress, versionReset } = useModuleProgress(found);
  const total = quiz.questions.length;
  const [current, setCurrent] = useState(() => startingQuestion(progress?.step, total));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const answers = progress?.answers ?? {};
  const question = quiz.questions[current - 1];
  const navigation = quizNavigation(current, total);
  const unanswered = unansweredQuestions(quiz.questions, answers);
  const alreadySubmitted = progress?.quizSubmitted === true;

  // A submitted Quiz shows its Result until the Learner chooses Retry.
  useEffect(() => {
    if (alreadySubmitted && !submitting) router.replace(routes.result(found.id));
  }, [alreadySubmitted, submitting, router, found.id]);

  // Save the place and move focus to the new Question heading.
  useEffect(() => {
    if (alreadySubmitted) return;
    updateProgress((store) => recordStep(store, found, { kind: "quiz", question: current }, nowIso()));
    headingRef.current?.focus();
  }, [found, current, alreadySubmitted]);

  if (alreadySubmitted && !submitting) return <LoadingState label="Opening your result…" />;
  if (!question) return <NoQuiz found={found} />;

  function answer(value: string) {
    if (!question) return;
    const questionId = question.id;
    updateProgress((store) => recordAnswer(store, found, questionId, value, nowIso()));
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(false);
    try {
      await scorer.score(found.id, answers);
      updateProgress((store) => markQuizSubmitted(store, found, nowIso()));
      router.push(routes.result(found.id));
    } catch {
      setSubmitError(true);
      setSubmitting(false);
    }
  }

  const place = `Question ${current} of ${total}`;
  const value = answers[question.id] ?? "";

  return (
    <div className="mx-auto max-w-[44rem]">
      <ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} current="Short quiz" />
      {versionReset ? <VersionResetNotice /> : null}

      <div className="border border-border bg-surface p-6 sm:p-10">
        <StepProgress current={current} total={total} label={place} className="mb-8 max-w-[20rem]" />

        {question.kind === "choice" ? (
          <ChoiceQuestion question={question} answer={value} onAnswer={answer} headingRef={headingRef} />
        ) : (
          <TextQuestion question={question} answer={value} onAnswer={answer} headingRef={headingRef} />
        )}

        {navigation.isLast ? <UnansweredSummary numbers={unanswered} onGoTo={setCurrent} /> : null}

        {submitError ? (
          <Alert variant="destructive" className="mt-8">
            <AlertDescription>
              Your answers could not be scored on this device. They are saved; try Submit again.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-10 flex flex-wrap justify-between gap-4 border-t border-border pt-8">
          {navigation.previous !== null ? (
            <Button variant="outline" onClick={() => setCurrent(navigation.previous ?? 1)}>
              Previous
            </Button>
          ) : (
            <span />
          )}
          {navigation.next !== null ? (
            <Button onClick={() => setCurrent(navigation.next ?? total)}>Next</Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
