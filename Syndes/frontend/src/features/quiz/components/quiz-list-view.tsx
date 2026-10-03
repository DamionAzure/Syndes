"use client";

import Link from "next/link";
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
    <div className="mx-auto max-w-[56rem]">
      {withQuiz.length === 0 ? (
        <div className="mt-10 border-y border-border py-8">
          <h2 className="text-section font-semibold">No quizzes on this device</h2>
          <p className="mt-2 text-muted-foreground">Quizzes come with modules.</p>
          <Link href={routes.library()} className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            Browse modules
          </Link>
        </div>
      ) : (
        <ul className="mt-10 border-t border-border">
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
                className="grid gap-4 border-b border-border py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <h2 className="text-section font-semibold">{summary.title}</h2>
                  <p className="text-meta text-muted-foreground">
                    {summary.questionCount} {summary.questionCount === 1 ? "question" : "questions"}
                    {status ? ` · ${status}` : ""}
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
