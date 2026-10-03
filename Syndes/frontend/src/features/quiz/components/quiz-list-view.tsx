"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useModules } from "@/features/modules/module-source";
import { routes } from "@/features/modules/routes";
import { isCompleted, readModuleProgress } from "@/features/progress/progress-store";
import { useProgressStore } from "@/features/progress/use-progress";

export function QuizListView() {
  const modules = useModules();
  const store = useProgressStore();
  const withQuiz = modules.filter((summary) => summary.readyOffline && summary.questionCount > 0);

  return (
    <div>
      {withQuiz.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-section font-semibold">No quizzes on this device</h2>
          <p className="text-muted-foreground">Quizzes come with modules.</p>
          <Link href={routes.library()} className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            Browse modules
          </Link>
        </div>
      ) : (
        <ul aria-label="Quizzes" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {withQuiz.map((summary) => {
            const { progress } = readModuleProgress(store, summary);
            const started =
              progress !== null &&
              (progress.quizSubmitted ||
                progress.step.kind === "quiz" ||
                Object.keys(progress.answers).length > 0);
            // R6.1: Completed or in progress, in words; nothing extra before a start.
            const status =
              progress && isCompleted(progress, summary) ? "Completed" : started ? "In progress" : null;
            const href = progress?.quizSubmitted ? routes.result(summary.id) : routes.quiz(summary.id);
            return (
              <li
                key={summary.id}
                className="grid gap-4 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-body font-semibold">{summary.title}</h2>
                    {status ? (
                      <Badge variant={status === "Completed" ? "default" : "outline"}>{status}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-meta text-muted-foreground">
                    {summary.subject}, {summary.questionCount}{" "}
                    {summary.questionCount === 1 ? "question" : "questions"}
                  </p>
                </div>
                <Link
                  href={href}
                  className={buttonVariants({ variant: started ? "default" : "outline" })}
                  aria-label={`${started ? "Continue quiz" : "Start quiz"}: ${summary.title}`}
                >
                  {started ? "Continue quiz" : "Start quiz"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
