"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { QUARTERS, type ComponentScore, type Quarter } from "../class-record-types";
import { classLabel, useClassRecords } from "../class-record-source";
import {
  byFamilyName,
  computeGrade,
  PASSING_GRADE,
  WEIGHTS,
  type ComputedGrade,
  type Descriptor,
} from "../grading";
import { classRecordRoutes } from "../routes";

const DESCRIPTORS: readonly Descriptor[] = [
  "Outstanding",
  "Very satisfactory",
  "Satisfactory",
  "Fairly satisfactory",
  "Did not meet expectations",
];

function parseQuarter(raw: string | null): Quarter {
  return QUARTERS.find((quarter) => String(quarter) === raw) ?? 1;
}

function Score({ score, percent }: { score: ComponentScore; percent: number }) {
  return (
    <span className="grid justify-items-end">
      <span className="text-body">{percent.toFixed(2)}</span>
      <span className="text-muted-foreground">
        {score.score} of {score.highest}
      </span>
    </span>
  );
}

/**
 * The class record: one row per Learner, components weighted for the
 * learning area, and the quarterly grade as the column the eye lands on.
 */
export function GradesView() {
  const { classes, sections, learners, grades } = useClassRecords();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const schoolClass = classes.find((candidate) => candidate.id === searchParams.get("class")) ?? classes[0];
  const quarter = parseQuarter(searchParams.get("quarter"));

  if (!schoolClass) {
    return <p className="text-muted-foreground">No classes are assigned to you yet.</p>;
  }

  const weights = WEIGHTS[schoolClass.weightGroup];
  const rows = learners
    .filter((learner) => learner.sectionId === schoolClass.sectionId)
    .sort(byFamilyName)
    .map((learner) => {
      const record = grades.find(
        (entry) => entry.learnerId === learner.id && entry.classId === schoolClass.id && entry.quarter === quarter,
      );
      return { learner, record, grade: record ? computeGrade(record, schoolClass.weightGroup) : null };
    });
  const finals = rows.flatMap(({ grade }) => (grade?.status === "final" ? [grade] : []));
  const started = rows.some(({ record }) => record);
  const complete = started && finals.length === rows.length;

  const classItems = classes.map((candidate) => ({ value: candidate.id, label: classLabel(candidate, sections) }));
  const quarterItems = QUARTERS.map((value) => ({ value: String(value), label: `Quarter ${value}` }));

  function select(next: { classId?: string; quarter?: Quarter }) {
    // Class and quarter live in the URL so a Learner's profile can link straight to their class record.
    const query = new URLSearchParams({
      class: next.classId ?? schoolClass?.id ?? "",
      quarter: String(next.quarter ?? quarter),
    });
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-[minmax(0,20rem)_12rem_minmax(0,1fr)] sm:items-end">
        <Field>
          <FieldLabel htmlFor="grades-class" className="text-meta">
            Class
          </FieldLabel>
          <Select items={classItems} value={schoolClass.id} onValueChange={(value) => select({ classId: String(value) })}>
            <SelectTrigger id="grades-class" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="grades-quarter" className="text-meta">
            Quarter
          </FieldLabel>
          <Select items={quarterItems} value={String(quarter)} onValueChange={(value) => select({ quarter: parseQuarter(String(value)) })}>
            <SelectTrigger id="grades-quarter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quarterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="text-meta text-muted-foreground sm:pb-3">
          {schoolClass.learningArea} weights: written work {weights.writtenWork}%, performance tasks{" "}
          {weights.performanceTasks}%, quarterly assessment {weights.quarterlyAssessment}%.
        </p>
      </div>

      {!started ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-section font-semibold">Nothing recorded for Quarter {quarter} yet</h2>
          <p className="max-w-[52ch] text-muted-foreground">
            Scores appear here as written work and performance tasks are recorded for this class.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="standing-heading" className="rounded-xl border border-border bg-surface px-6 py-5">
            <h2 id="standing-heading" className="font-semibold">
              {complete ? `Quarter ${quarter} standing` : `Quarter ${quarter} is under way`}
            </h2>
            {complete ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                {DESCRIPTORS.map((descriptor) => (
                  <div key={descriptor} className="grid gap-0.5">
                    <dt className="text-meta text-muted-foreground">{descriptor}</dt>
                    <dd
                      className={cn(
                        "text-section font-semibold tabular-nums",
                        descriptor === "Did not meet expectations" && finals.some((g) => g.descriptor === descriptor) && "text-destructive",
                      )}
                    >
                      {finals.filter((grade) => grade.descriptor === descriptor).length}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Quarterly grades appear once the quarterly assessment is recorded. Percentages so far are shown below.
              </p>
            )}
          </section>

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <Table label={`Class record, ${classLabel(schoolClass, sections)}, Quarter ${quarter}`}>
              <TableCaption>
                Percentage scores are rounded to two decimals. Initial grades are transmuted using the DepEd table (DO 8,
                s. 2015); {PASSING_GRADE} is the lowest passing grade.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  {/* No. and Learner stay pinned together while the scores scroll sideways. */}
                  <TableHead scope="col" className="sticky left-0 w-14 min-w-14 bg-surface-muted text-right">
                    No.
                  </TableHead>
                  <TableHead scope="col" className="sticky left-14 bg-surface-muted shadow-[1px_0_0_var(--border)]">
                    Learner
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Written work, {weights.writtenWork}%
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Performance tasks, {weights.performanceTasks}%
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Quarterly assessment, {weights.quarterlyAssessment}%
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Initial grade
                  </TableHead>
                  <TableHead scope="col" className="border-l border-border text-right text-foreground">
                    Quarterly grade
                  </TableHead>
                  <TableHead scope="col">Descriptor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ learner, record, grade }, index) => (
                  <GradeRow
                    key={learner.id}
                    number={index + 1}
                    name={`${learner.familyName}, ${learner.givenName}`}
                    href={classRecordRoutes.learner(learner.id)}
                    record={record}
                    grade={grade}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function GradeRow({
  number,
  name,
  href,
  record,
  grade,
}: {
  number: number;
  name: string;
  href: string;
  record: { writtenWork: ComponentScore; performanceTasks: ComponentScore; quarterlyAssessment: ComponentScore | null } | undefined;
  grade: ComputedGrade | null;
}) {
  const failing = grade?.status === "final" && grade.quarterlyGrade < PASSING_GRADE;
  return (
    <TableRow className={cn(failing && "bg-[color-mix(in_srgb,var(--surface),var(--destructive)_6%)]")}>
      <TableCell className={cn("sticky left-0 w-14 min-w-14 text-right text-muted-foreground", failing ? "bg-[color-mix(in_srgb,var(--surface),var(--destructive)_6%)]" : "bg-surface")}>
        {number}
      </TableCell>
      <TableHead
        scope="row"
        className={cn(
          "sticky left-14 text-body font-medium whitespace-nowrap text-foreground shadow-[1px_0_0_var(--border)]",
          failing ? "bg-[color-mix(in_srgb,var(--surface),var(--destructive)_6%)]" : "bg-surface",
        )}
      >
        <Link href={href} className="text-primary underline-offset-4 hover:underline">
          {name}
        </Link>
      </TableHead>
      {record && grade ? (
        <>
          <TableCell className="text-right">
            <Score score={record.writtenWork} percent={grade.writtenWork} />
          </TableCell>
          <TableCell className="text-right">
            <Score score={record.performanceTasks} percent={grade.performanceTasks} />
          </TableCell>
          <TableCell className="text-right">
            {grade.status === "final" && record.quarterlyAssessment ? (
              <Score score={record.quarterlyAssessment} percent={grade.quarterlyAssessment} />
            ) : (
              <span className="text-muted-foreground">Not given</span>
            )}
          </TableCell>
          <TableCell className="text-right">
            {grade.status === "final" ? grade.initialGrade.toFixed(2) : <span className="text-muted-foreground">Not final</span>}
          </TableCell>
          <TableCell className="border-l border-border text-right">
            {grade.status === "final" ? (
              <span className={cn("text-section font-semibold", failing && "text-destructive")}>{grade.quarterlyGrade}</span>
            ) : (
              <span className="text-muted-foreground">Not final</span>
            )}
          </TableCell>
          <TableCell className={cn(failing && "font-medium text-destructive")}>
            {grade.status === "final" ? grade.descriptor : ""}
          </TableCell>
        </>
      ) : (
        <TableCell colSpan={6} className="text-muted-foreground">
          No scores recorded this quarter
        </TableCell>
      )}
    </TableRow>
  );
}
