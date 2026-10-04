"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkDraft } from "@/features/authoring/draft-checks";
import { draftContents, draftTitle, listDrafts } from "@/features/authoring/draft-store";
import { authoringRoutes } from "@/features/authoring/routes";
import { useDraftStore } from "@/features/authoring/use-drafts";
import { sectionLabel, useClassRecords } from "@/features/class-records/class-record-source";
import { ResultText } from "@/features/class-records/components/module-report";
import { byFamilyName, fullName, LOW_RESULT_PERCENT, resultPercent } from "@/features/class-records/grading";
import { classRecordRoutes } from "@/features/class-records/routes";
import { TodayAgenda } from "@/features/schedule/components/today-agenda";
import { standaloneLink } from "@/lib/link-styles";
import { cn } from "@/lib/utils";

const ATTENTION_LIMIT = 5;
const DRAFT_LIMIT = 3;

/**
 * Main column: the day as it will happen. Side column: who needs a look and
 * what is still being written. Wide screens use both; narrow screens stack
 * them in that order.
 */
export function TeachOverview() {
  const { learners, sections, reports } = useClassRecords();
  const drafts = listDrafts(useDraftStore()).slice(0, DRAFT_LIMIT);

  const attention = learners
    .flatMap((learner) => {
      const low = reports
        .filter((report) => report.learnerId === learner.id)
        .filter((report) => {
          const percent = resultPercent(report);
          return percent !== null && percent < LOW_RESULT_PERCENT;
        });
      return low.length ? [{ learner, low }] : [];
    })
    .sort((a, b) => byFamilyName(a.learner, b.learner));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <TodayAgenda />

      <aside aria-label="Follow-ups" className="grid gap-6">
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b pb-5">
            <CardTitle id="attention-heading">Needs a look</CardTitle>
            <CardDescription>
              {attention.length === 0
                ? "No quiz results below 60%."
                : `${attention.length} ${attention.length === 1 ? "learner" : "learners"} with a quiz result below 60%`}
            </CardDescription>
          </CardHeader>
          {attention.length > 0 ? (
            <ul aria-labelledby="attention-heading" className="divide-y divide-border">
              {attention.slice(0, ATTENTION_LIMIT).map(({ learner, low }) => {
                const section = sections.find((candidate) => candidate.id === learner.sectionId);
                return (
                  <li key={learner.id} className="grid gap-1 px-6 py-4">
                    <Link
                      href={classRecordRoutes.learner(learner.id)}
                      className={cn(standaloneLink, "justify-self-start font-medium")}
                    >
                      {fullName(learner)}
                    </Link>
                    <p className="text-meta text-muted-foreground">
                      {section ? `${sectionLabel(section)}. ` : ""}
                      {low.map((report, index) => (
                        <span key={report.moduleId}>
                          {index > 0 ? "; " : ""}
                          {report.moduleTitle}: <ResultText report={report} />
                        </span>
                      ))}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="border-t border-border px-6 py-4">
            <Link href={classRecordRoutes.scores()} className={buttonVariants({ variant: "outline", size: "sm" })}>
              See all scores
            </Link>
          </div>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="border-b pb-5">
            <CardTitle id="drafts-heading">Drafts</CardTitle>
            <CardDescription>Modules, quizzes and flashcards you are still writing</CardDescription>
            <CardAction>
              <Link href={authoringRoutes.drafts()} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open editor
              </Link>
            </CardAction>
          </CardHeader>
          {drafts.length === 0 ? (
            <CardContent className="py-5">
              <p className="text-muted-foreground">No drafts yet. Start one from the editor.</p>
            </CardContent>
          ) : (
            <ul aria-labelledby="drafts-heading" className="divide-y divide-border">
              {drafts.map((draft) => {
                const issues = checkDraft(draft).length;
                return (
                  <li key={draft.id} className="grid gap-1 px-6 py-4">
                    <Link
                      href={authoringRoutes.editor(draft.id)}
                      className={cn(standaloneLink, "justify-self-start font-medium")}
                    >
                      {draftTitle(draft)}
                    </Link>
                    <p className="text-meta text-muted-foreground">
                      {draftContents(draft)}. {issues === 0 ? "Ready to seal." : `${issues} to fix.`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
