"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sectionLabel, useClassRecords } from "../class-record-source";
import { byFamilyName, LOW_RESULT_PERCENT, moduleStatus, resultPercent } from "../grading";
import { classRecordRoutes } from "../routes";
import { ALL_SECTIONS, SectionFilter } from "./section-filter";

export function LearnersView() {
  const { learners, sections, reports } = useClassRecords();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState(ALL_SECTIONS);

  const needle = query.trim().toLowerCase();
  const shown = learners
    .filter((learner) => section === ALL_SECTIONS || learner.sectionId === section)
    .filter(
      (learner) =>
        !needle ||
        `${learner.givenName} ${learner.familyName}`.toLowerCase().includes(needle) ||
        learner.lrn.includes(needle),
    )
    .sort(byFamilyName);
  const filtered = needle !== "" || section !== ALL_SECTIONS;

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      <div
        role="search"
        aria-label="Find a learner"
        className="grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2 lg:sticky lg:top-8 lg:grid-cols-1"
      >
        <Field>
          <FieldLabel htmlFor="learner-search" className="text-meta">
            Name or LRN
          </FieldLabel>
          <Input id="learner-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </Field>
        <SectionFilter id="learner-section" sections={sections} value={section} onChange={setSection} />
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-2 lg:col-span-1">
          <p role="status" className="text-meta text-muted-foreground">
            {shown.length} {shown.length === 1 ? "learner" : "learners"}
          </p>
          {filtered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setSection(ALL_SECTIONS);
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-section font-semibold">No learners match</h2>
          <p className="text-muted-foreground">Check the spelling, or search all sections.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table label="Learners">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Learner</TableHead>
                <TableHead scope="col">LRN</TableHead>
                <TableHead scope="col">Section</TableHead>
                <TableHead scope="col" className="text-right">
                  Modules completed
                </TableHead>
                <TableHead scope="col">Needs a look</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((learner) => {
                const own = reports.filter((report) => report.learnerId === learner.id);
                const completed = own.filter((report) => moduleStatus(report) === "completed").length;
                const low = own.filter((report) => {
                  const percent = resultPercent(report);
                  return percent !== null && percent < LOW_RESULT_PERCENT;
                });
                const learnerSection = sections.find((candidate) => candidate.id === learner.sectionId);
                return (
                  <TableRow key={learner.id}>
                    <TableCell className="text-body">
                      <Link
                        href={classRecordRoutes.learner(learner.id)}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {learner.familyName}, {learner.givenName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{learner.lrn}</TableCell>
                    <TableCell>{learnerSection ? sectionLabel(learnerSection) : "No section"}</TableCell>
                    <TableCell className="text-right">
                      {completed} of {own.length}
                    </TableCell>
                    <TableCell>
                      {low.length > 0 ? (
                        <span className="text-destructive">
                          Below 60% in {low.map((report) => report.moduleTitle).join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Nothing flagged</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
