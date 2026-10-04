"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { standaloneLink } from "@/lib/link-styles";
import { cn } from "@/lib/utils";
import { QUARTERS } from "../class-record-types";
import { classLabel, sectionLabel, useClassRecords } from "../class-record-source";
import { computeGrade, fullName, MODULE_STATUS_LABEL, moduleStatus } from "../grading";
import { classRecordRoutes } from "../routes";
import { ModuleReport, shortDate } from "./module-report";

const HEADING_ID = "learner-heading";

export function LearnerProfileView() {
  const learnerId = useSearchParams().get("learner");
  const { learners, sections, classes, reports, grades } = useClassRecords();
  const learner = learners.find((candidate) => candidate.id === learnerId);

  if (!learner) {
    return (
      <>
        <PageHeader id={HEADING_ID} icon={UserRound} title="Learner not found" />
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="text-muted-foreground">This learner is not in any of your sections.</p>
          <Link href={classRecordRoutes.learners()} className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            Go to learners
          </Link>
        </div>
      </>
    );
  }

  const section = sections.find((candidate) => candidate.id === learner.sectionId);
  const own = reports.filter((report) => report.learnerId === learner.id);
  const learnerClasses = classes.filter((schoolClass) => schoolClass.sectionId === learner.sectionId);

  return (
    <>
      <PageHeader
        id={HEADING_ID}
        icon={UserRound}
        title={fullName(learner)}
        description={section ? sectionLabel(section) : "No section"}
        context={
          <Link href={classRecordRoutes.learners()} className={cn(standaloneLink, "text-meta")}>
            All learners
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] xl:items-start">
        <section aria-labelledby="info-heading" className="rounded-xl border border-border bg-surface p-6">
          <h2 id="info-heading" className="text-section font-semibold">
            Information
          </h2>
          <dl className="mt-4 grid gap-4">
            {[
              ["LRN", learner.lrn],
              ["Section", section ? sectionLabel(section) : "No section"],
              ["Parent or guardian", `${learner.guardian.name}, ${learner.guardian.relationship.toLowerCase()}`],
              ["Guardian contact", learner.guardian.contact],
            ].map(([term, detail]) => (
              <div key={term} className="grid gap-0.5 border-b border-border pb-3 last:border-0 last:pb-0">
                <dt className="text-meta text-muted-foreground">{term}</dt>
                <dd className="tabular-nums [overflow-wrap:anywhere]">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="grid min-w-0 gap-6">
          <section aria-labelledby="modules-heading" className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-6 py-4">
              <h2 id="modules-heading" className="text-section font-semibold">
                Modules
              </h2>
              <p className="text-meta text-muted-foreground">Progress and quiz results, as last reported from the learner&apos;s device.</p>
            </div>
            <Table label={`Modules for ${fullName(learner)}`}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Module</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Result or place</TableHead>
                  <TableHead scope="col">Last reported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {own.map((report) => (
                  <TableRow key={report.moduleId}>
                    <TableHead scope="row" className="text-body font-medium text-foreground">
                      {report.moduleTitle}
                    </TableHead>
                    <TableCell>{MODULE_STATUS_LABEL[moduleStatus(report)]}</TableCell>
                    <TableCell>
                      <ModuleReport report={report} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{shortDate(report.reportedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section aria-labelledby="grades-heading" className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-6 py-4">
              <h2 id="grades-heading" className="text-section font-semibold">
                Quarterly grades
              </h2>
              <p className="text-meta text-muted-foreground">From your class records. A quarter has no grade until its quarterly assessment.</p>
            </div>
            <Table label={`Quarterly grades for ${fullName(learner)}`}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Class</TableHead>
                  {QUARTERS.map((quarter) => (
                    <TableHead key={quarter} scope="col" className="text-right">
                      Quarter {quarter}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {learnerClasses.map((schoolClass) => (
                  <TableRow key={schoolClass.id}>
                    <TableHead scope="row" className="text-body font-medium text-foreground">
                      <Link
                        href={classRecordRoutes.grades(schoolClass.id)}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {classLabel(schoolClass, sections)}
                      </Link>
                    </TableHead>
                    {QUARTERS.map((quarter) => {
                      const record = grades.find(
                        (entry) => entry.learnerId === learner.id && entry.classId === schoolClass.id && entry.quarter === quarter,
                      );
                      const grade = record ? computeGrade(record, schoolClass.weightGroup) : null;
                      return (
                        <TableCell key={quarter} className="text-right">
                          {grade?.status === "final" ? (
                            <span className="grid">
                              <span className="text-body font-semibold">{grade.quarterlyGrade}</span>
                              <span className="text-muted-foreground">{grade.descriptor}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{grade ? "Not final" : "Not started"}</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      </div>
    </>
  );
}
