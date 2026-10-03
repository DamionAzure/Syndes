"use client";

import { Check, LibraryBig } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useModuleProgress } from "@/features/progress/use-progress";
import type { Module } from "../module-types";
import { hrefForStep, routes } from "../routes";
import { useModuleParam } from "../use-module-param";
import { Availability } from "./availability";
import { ModuleBreadcrumb } from "./module-breadcrumb";
import { lessonCountLabel } from "./module-row";
import { ModuleNotFound } from "./module-not-found";
import { VersionResetNotice } from "./version-reset-notice";

export function ModuleOverviewView() {
  const found = useModuleParam();
  if (!found) return <ModuleNotFound />;
  return <ModuleOverview key={found.id} found={found} />;
}

function ModuleOverview({ found }: { found: Module }) {
  const { progress, versionReset } = useModuleProgress(found);
  const quizLength = found.quiz?.questions.length ?? 0;
  const totalMinutes = found.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  const savedLesson = progress?.step.kind === "lesson" ? progress.step.lesson : null;

  return (
    <>
      <PageHeader
        icon={LibraryBig}
        context={<ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} />}
        title={found.title}
        description={found.summary}
        actions={
          <>
            {found.flashcards?.length ? (
              <Link href={routes.flashcards(found.id)} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Study flashcards
              </Link>
            ) : null}
            {progress && progress.step.kind !== "overview" ? (
              <Link href={hrefForStep(found.id, progress.step)} className={buttonVariants({ size: "lg" })}>
                Continue module
              </Link>
            ) : (
              <Link href={routes.lesson(found.id, 1)} className={buttonVariants({ size: "lg" })}>
                Start module
              </Link>
            )}
          </>
        }
      />
      {versionReset ? <VersionResetNotice /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b pb-5">
            <CardTitle id="sequence-heading">Lessons</CardTitle>
            <CardDescription>
              {lessonCountLabel(found.lessons.length)}, about {totalMinutes} minutes
              {quizLength > 0 ? ", then a short quiz" : ""}
            </CardDescription>
          </CardHeader>
          <ol aria-labelledby="sequence-heading" className="divide-y divide-border">
            {found.lessons.map((lesson, index) => {
              const number = index + 1;
              const isSaved = savedLesson === number;
              return (
                <li key={lesson.id}>
                  <Link
                    href={routes.lesson(found.id, number)}
                    className="grid min-h-(--control-height) grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-6 py-4 hover:bg-surface-muted"
                  >
                    <span className="grid size-8 place-content-center rounded-md bg-surface-muted text-meta font-semibold tabular-nums text-muted-foreground">
                      {number}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{lesson.title}</span>
                      {lesson.subtitle ? (
                        <span className="block truncate text-meta text-muted-foreground">{lesson.subtitle}</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3 text-meta text-muted-foreground">
                      {isSaved ? <Badge variant="outline">Your place</Badge> : null}
                      {lesson.minutes} min
                    </span>
                  </Link>
                </li>
              );
            })}
            {quizLength > 0 ? (
              <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 bg-surface-muted/50 px-6 py-4">
                <span aria-hidden="true" />
                <span className="font-medium">Short quiz</span>
                <span className="text-meta text-muted-foreground">
                  {quizLength} {quizLength === 1 ? "question" : "questions"}
                </span>
              </li>
            ) : null}
          </ol>
        </Card>

        <aside aria-label="About this module" className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle id="outcomes-heading">What you will learn</CardTitle>
            </CardHeader>
            <CardContent>
              <ul aria-labelledby="outcomes-heading" className="grid gap-3">
                {found.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-3">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="grid gap-2 text-meta text-muted-foreground">
              <p className="font-medium text-foreground">{found.subject}</p>
              <Availability readyOffline={found.readyOffline} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
