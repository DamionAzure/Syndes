"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { FolioLayout } from "@/components/layout/folio-layout";
import { ModuleBreadcrumb } from "@/features/modules/components/module-breadcrumb";
import { ModuleNotFound } from "@/features/modules/components/module-not-found";
import { VersionResetNotice } from "@/features/modules/components/version-reset-notice";
import type { Module } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";
import { useModuleParam, usePositionParam } from "@/features/modules/use-module-param";
import { placeLabel } from "@/features/progress/place-label";
import { markFinalLessonReached, recordStep } from "@/features/progress/progress-store";
import { nowIso, updateProgress, useModuleProgress } from "@/features/progress/use-progress";
import { ChapterRail } from "./chapter-rail";
import { LessonReader, type LessonNavLink } from "./lesson-reader";
import { StudyMargin } from "./study-margin";

export function LessonView() {
  const found = useModuleParam();
  if (!found || found.lessons.length === 0) return <ModuleNotFound />;
  return <ModuleLessons key={found.id} found={found} />;
}

function ModuleLessons({ found }: { found: Module }) {
  const router = useRouter();
  const requested = usePositionParam("lesson");
  const total = found.lessons.length;
  const inRange = requested !== null && requested <= total;
  const number = inRange ? requested : 1;
  const lesson = found.lessons[number - 1] ?? found.lessons[0];
  const { versionReset } = useModuleProgress(found);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasQuiz = (found.quiz?.questions.length ?? 0) > 0;
  const place = placeLabel(
    { kind: "lesson", lesson: number },
    { lessonCount: total, questionCount: found.quiz?.questions.length ?? 0 },
  );

  // An out-of-range lesson falls back to Lesson 1 and the URL follows.
  useEffect(() => {
    if (!inRange) router.replace(routes.lesson(found.id, 1));
  }, [inRange, router, found.id]);

  // Save the place and move focus to the new Lesson heading.
  useEffect(() => {
    const now = nowIso();
    updateProgress((store) => {
      const placed = recordStep(store, found, { kind: "lesson", lesson: number }, now);
      return number === total ? markFinalLessonReached(placed, found, now) : placed;
    });
    headingRef.current?.focus();
  }, [found, number, total]);

  if (!lesson) return <ModuleNotFound />;

  const previous: LessonNavLink =
    number > 1
      ? { href: routes.lesson(found.id, number - 1), label: "Previous lesson" }
      : { href: routes.module(found.id), label: "Module overview" };
  const next: LessonNavLink =
    number < total
      ? { href: routes.lesson(found.id, number + 1), label: "Next lesson" }
      : hasQuiz
        ? { href: routes.quiz(found.id), label: "Start short quiz" }
        : { href: routes.module(found.id), label: "Finish module" };

  return (
    <div>
      <div className="mx-auto max-w-[82rem]">
        <ModuleBreadcrumb moduleId={found.id} moduleTitle={found.title} current={place} />
        {versionReset ? <VersionResetNotice /> : null}
      </div>
      <FolioLayout
        rail={<ChapterRail found={found} current={number} />}
        margin={<StudyMargin lesson={lesson} place={place} readyOffline={found.readyOffline} />}
      >
        <LessonReader
          lesson={lesson}
          place={place}
          number={number}
          total={total}
          previous={previous}
          next={next}
          headingRef={headingRef}
        />
      </FolioLayout>
    </div>
  );
}
