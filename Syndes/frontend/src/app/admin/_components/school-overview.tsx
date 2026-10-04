"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  accessStateOf,
  activeAssignment,
  classLabel,
  fullName,
  timestampLabel,
} from "@/features/school-directory/directory";
import { adminRoutes } from "@/features/school-directory/routes";
import { useDirectory } from "@/features/school-directory/use-directory";
import { SchoolStatistics } from "@/features/school-statistics/components/school-statistics";
import { standaloneLink } from "@/lib/link-styles";
import { cn } from "@/lib/utils";

const LIST_LIMIT = 4;

/**
 * Main column: how the school is doing, counted per grading period. Side
 * column: what needs the Administrator today. Narrow screens stack them in
 * that order.
 */
export function SchoolOverview() {
  const directory = useDirectory();
  const now = new Date().toISOString();
  const waiting = directory.accounts
    .filter((account) => accessStateOf(directory, account) === "waiting")
    .sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt));
  const unassigned = directory.classes.filter((schoolClass) => !activeAssignment(directory, schoolClass.id));
  const enrolledNow = directory.enrollments.filter((enrollment) => enrollment.endedAt === null).length;
  const dropped = directory.enrollments.filter((enrollment) => enrollment.status === "dropped").length;
  const transferred = directory.enrollments.filter((enrollment) => enrollment.status === "transferred").length;
  const teachers = directory.accounts.filter((account) => accessStateOf(directory, account) === "teacher").length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <SchoolStatistics />

      <aside aria-label="Needs your attention" className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Right now</CardTitle>
            <CardDescription>
              From the school directory, as of <time dateTime={now}>{timestampLabel(now)}</time>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              {[
                ["Enrolled", enrolledNow],
                ["Teachers", teachers],
                ["Dropped this year", dropped],
                ["Transferred out", transferred],
              ].map(([term, value]) => (
                <div key={term} className="grid gap-0.5">
                  <dt className="text-meta text-muted-foreground">{term}</dt>
                  <dd className="text-section font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="border-b pb-5">
            <CardTitle id="waiting-heading">Waiting for access</CardTitle>
            <CardDescription>
              {waiting.length === 0
                ? "Nobody. New sign-ins appear here."
                : `${waiting.length} ${waiting.length === 1 ? "person has" : "people have"} signed in but have no section or Teacher access.`}
            </CardDescription>
          </CardHeader>
          {waiting.length > 0 ? (
            <ul aria-labelledby="waiting-heading" className="divide-y divide-border">
              {waiting.slice(0, LIST_LIMIT).map((account) => (
                <li key={account.id} className="grid gap-0.5 px-6 py-3">
                  <Link href={adminRoutes.person(account.id)} className={cn(standaloneLink, "justify-self-start font-medium")}>
                    {fullName(account)}
                  </Link>
                  <span className="text-meta text-muted-foreground">
                    {account.email}, signed in {timestampLabel(account.joinedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="border-t border-border px-6 py-4">
            <Link href={adminRoutes.people("waiting")} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Review everyone waiting
            </Link>
          </div>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="border-b pb-5">
            <CardTitle id="unassigned-heading">Classes without a teacher</CardTitle>
            <CardDescription>
              {unassigned.length === 0 ? "Every class has a teacher." : "Nobody sees these learners' records until a teacher is assigned."}
            </CardDescription>
          </CardHeader>
          {unassigned.length > 0 ? (
            <ul aria-labelledby="unassigned-heading" className="divide-y divide-border">
              {unassigned.slice(0, LIST_LIMIT).map((schoolClass) => (
                <li key={schoolClass.id} className="px-6 py-3">
                  {classLabel(directory, schoolClass)}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="border-t border-border px-6 py-4">
            <Link href={adminRoutes.sections()} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Go to sections
            </Link>
          </div>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="border-b pb-5">
            <CardTitle id="recent-heading">Recent changes</CardTitle>
          </CardHeader>
          <ol aria-labelledby="recent-heading" className="divide-y divide-border">
            {directory.activity.slice(0, LIST_LIMIT).map((entry) => (
              <li key={entry.id} className="grid gap-0.5 px-6 py-3">
                <span className="text-meta text-muted-foreground tabular-nums">{timestampLabel(entry.at)}</span>
                <span>{entry.summary}</span>
              </li>
            ))}
          </ol>
          <div className="border-t border-border px-6 py-4">
            <Link href={adminRoutes.activity()} className={buttonVariants({ variant: "outline", size: "sm" })}>
              See all activity
            </Link>
          </div>
        </Card>
      </aside>
    </div>
  );
}
