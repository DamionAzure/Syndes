"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportedModule } from "../class-record-types";
import { useClassRecords } from "../class-record-source";
import { byFamilyName, moduleStatus, resultPercent } from "../grading";
import { classRecordRoutes } from "../routes";
import { ModuleReport } from "./module-report";
import { ALL_SECTIONS, SectionFilter } from "./section-filter";

function summary(reports: readonly ReportedModule[]): string {
  const percents = reports.map(resultPercent).filter((percent): percent is number => percent !== null);
  const completed = reports.filter((report) => moduleStatus(report) === "completed").length;
  const completedText = `${completed} of ${reports.length} completed`;
  if (percents.length === 0) return completedText;
  const average = Math.round(percents.reduce((sum, percent) => sum + percent, 0) / percents.length);
  return `Average ${average}%, ${completedText}`;
}

/** Learners down the side, Modules across: one Result or place per cell. */
export function ScoresView() {
  const { learners, sections, reports } = useClassRecords();
  const [section, setSection] = useState(ALL_SECTIONS);

  const shown = learners
    .filter((learner) => section === ALL_SECTIONS || learner.sectionId === section)
    .sort(byFamilyName);
  const shownIds = new Set(shown.map((learner) => learner.id));
  const modules = [...new Map(reports.map((report) => [report.moduleId, report.moduleTitle])).entries()];
  const reportFor = (learnerId: string, moduleId: string) =>
    reports.find((report) => report.learnerId === learnerId && report.moduleId === moduleId);

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-[18rem_minmax(0,1fr)] sm:items-end">
        <SectionFilter id="scores-section" sections={sections} value={section} onChange={setSection} />
        <p role="status" className="text-meta text-muted-foreground sm:pb-3">
          {shown.length} {shown.length === 1 ? "learner" : "learners"}. A result below 60% is marked in the table.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Table label="Module results by learner">
          <TableCaption>Results are scored on each learner&apos;s device and reported here.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="sticky left-0 bg-surface-muted">
                Learner
              </TableHead>
              {modules.map(([moduleId, title]) => (
                <TableHead key={moduleId} scope="col">
                  {title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((learner) => (
              <TableRow key={learner.id}>
                <TableHead scope="row" className="sticky left-0 bg-surface text-body font-medium text-foreground">
                  <Link
                    href={classRecordRoutes.learner(learner.id)}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {learner.familyName}, {learner.givenName}
                  </Link>
                </TableHead>
                {modules.map(([moduleId]) => {
                  const report = reportFor(learner.id, moduleId);
                  return (
                    <TableCell key={moduleId}>
                      {report ? <ModuleReport report={report} /> : <span className="text-muted-foreground">Not assigned</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableHead scope="row" className="sticky left-0 bg-surface-muted text-foreground">
                Class summary
              </TableHead>
              {modules.map(([moduleId]) => (
                <TableCell key={moduleId}>
                  {summary(reports.filter((report) => report.moduleId === moduleId && shownIds.has(report.learnerId)))}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
