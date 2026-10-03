"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useModuleProgress } from "@/features/progress/use-progress";
import { useModuleParam } from "../use-module-param";
import { hrefForStep, routes } from "../routes";
import { lessonCountLabel } from "./module-row";
import { ModuleBreadcrumb } from "./module-breadcrumb";
import { ModuleNotFound } from "./module-not-found";
import { VersionResetNotice } from "./version-reset-notice";
import type { Module } from "../module-types";

export function ModuleOverviewView() {
  const found = useModuleParam();
  if (!found) return <ModuleNotFound />;
  return <ModuleOverview key={found.id} found={found} />;
}

function ModuleOverview({ found }: { found: Module }) {
  const { progress, versionReset } = useModuleProgress(found);
  const quizLength = found.quiz?.questions.length ?? 0;

  return (
    <article className="mx-auto max-w-[56rem]">
      <ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} />
      {versionReset ? <VersionResetNotice /> : null}

      <p className="text-meta text-muted-foreground">{found.subject}</p>
      <h1 className="text-title font-semibold">{found.title}</h1>
      <p className="mt-3 max-w-[62ch] text-muted-foreground">{found.summary}</p>

      <div className="mt-8 flex flex-wrap gap-4">
        {progress && progress.step.kind !== "overview" ? (
          <Link href={hrefForStep(found.id, progress.step)} className={buttonVariants({ size: "lg" })}>
            Continue module
          </Link>
        ) : (
          <Link href={routes.lesson(found.id, 1)} className={buttonVariants({ size: "lg" })}>
            Start module
          </Link>
        )}
        {found.flashcards?.length ? (
          <Link href={routes.flashcards(found.id)} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Study flashcards
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="outcomes-heading" className="mt-12 border-t border-border pt-8">
        <h2 id="outcomes-heading" className="text-section font-semibold">
          What you will learn
        </h2>
        <ul className="mt-4 grid list-disc gap-2 pl-6">
          {found.outcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sequence-heading" className="mt-12 border-t border-border pt-8">
        <h2 id="sequence-heading" className="text-section font-semibold">
          {lessonCountLabel(found.lessons.length)}
          {quizLength > 0 ? " and a short quiz" : ""}
        </h2>
        <ol className="mt-4 border-t border-border">
          {found.lessons.map((lesson, index) => (
            <li
              key={lesson.id}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-border py-4"
            >
              <span className="text-meta text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{lesson.title}</span>
              <span className="text-meta text-muted-foreground">{lesson.minutes} min</span>
            </li>
          ))}
          {quizLength > 0 ? (
            <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-border py-4">
              <span aria-hidden="true" />
              <span>Short quiz</span>
              <span className="text-meta text-muted-foreground">
                {quizLength} {quizLength === 1 ? "question" : "questions"}
              </span>
            </li>
          ) : null}
        </ol>
      </section>
    </article>
  );
}
