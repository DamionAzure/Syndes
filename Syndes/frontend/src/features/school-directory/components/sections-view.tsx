"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  activeAssignment,
  classesIn,
  classLabel,
  findAccount,
  fullName,
  learnersIn,
  sectionLabel,
  sortedSections,
} from "../directory";
import { addClass, assignTeacher, createSection, unassignTeacher } from "../directory-actions";
import type { Directory, SchoolClass, Section } from "../directory-types";
import { adminRoutes } from "../routes";
import { useDirectory } from "../use-directory";
import { ActionFeedback, useDirectoryAction } from "./action-feedback";
import { NONE, TeacherPicker } from "./pickers";

const HEADING_ID = "sections-page-heading";

const GRADE_LEVELS = ["Kindergarten", ...Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`)];

const LEARNING_AREAS = [
  "Araling Panlipunan",
  "Edukasyon sa Pagpapakatao",
  "English",
  "EPP / TLE",
  "Filipino",
  "MAPEH",
  "Mathematics",
  "Mother Tongue",
  "Science",
];

type Run = ReturnType<typeof useDirectoryAction>["run"];

/**
 * The school's structure: each Section with its Learners and Classes, and who
 * teaches each Class. A Class without a teacher is said in words, because its
 * Learners have no one to see their records.
 */
export function SectionsView() {
  const directory = useDirectory();
  const { feedback, run } = useDirectoryAction();
  const sections = sortedSections(directory);
  const grades = [...new Set(sections.map((section) => section.gradeLevel))];
  const unassigned = directory.classes.filter((schoolClass) => !activeAssignment(directory, schoolClass.id)).length;

  return (
    <div className="grid gap-6">
      <ActionFeedback feedback={feedback} />
      <CreateSectionForm run={run} />
      <p className="text-muted-foreground">
        {sections.length} sections, {directory.classes.length} classes.{" "}
        {unassigned === 0 ? "Every class has a teacher." : `${unassigned} ${unassigned === 1 ? "class has" : "classes have"} no teacher.`}
      </p>
      {grades.map((grade) => (
        <section key={grade} aria-labelledby={`grade-${grade}`} className="grid gap-4">
          <h2 id={`grade-${grade}`} className="text-section font-semibold">
            {grade}
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {sections
              .filter((section) => section.gradeLevel === grade)
              .map((section) => (
                <SectionPanel key={section.id} directory={directory} section={section} run={run} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CreateSectionForm({ run }: { run: Run }) {
  const [gradeLevel, setGradeLevel] = useState("Grade 4");
  const [name, setName] = useState("");
  const items = GRADE_LEVELS.map((grade) => ({ value: grade, label: grade }));

  return (
    <form
      aria-labelledby="create-section-heading"
      className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const result = run((current, context) => createSection(current, { gradeLevel, name }, context));
        if (result.ok) setName("");
      }}
    >
      <h2 id="create-section-heading" className="font-semibold md:col-span-3">
        Create a section
      </h2>
      <Field>
        <FieldLabel htmlFor="new-section-grade" className="text-meta">
          Grade level
        </FieldLabel>
        <Select items={items} value={gradeLevel} onValueChange={(value) => setGradeLevel(String(value ?? "Grade 4"))}>
          <SelectTrigger id="new-section-grade" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="new-section-name" className="text-meta">
          Section name
        </FieldLabel>
        <Input id="new-section-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Del Pilar" />
      </Field>
      <Button type="submit" disabled={!name.trim()}>
        Create section
      </Button>
    </form>
  );
}

function SectionPanel({ directory, section, run }: { directory: Directory; section: Section; run: Run }) {
  const learners = learnersIn(directory, section.id).length;
  const classes = classesIn(directory, section.id);
  const missing = LEARNING_AREAS.filter((area) => !classes.some((schoolClass) => schoolClass.learningArea === area));
  const [area, setArea] = useState(NONE);
  const headingId = `section-${section.id}`;

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-5 py-4">
        <h3 id={headingId} className="font-semibold">
          {sectionLabel(section)}
        </h3>
        <Link
          href={adminRoutes.people("learner")}
          className="text-meta text-muted-foreground tabular-nums underline-offset-4 hover:text-foreground hover:underline"
        >
          {learners} {learners === 1 ? "learner" : "learners"} enrolled
        </Link>
      </div>
      {classes.length === 0 ? (
        <p className="px-5 py-4 text-muted-foreground">No classes yet. Add the learning areas this section takes.</p>
      ) : (
        <Table label={`Classes in ${sectionLabel(section)}`}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Learning area</TableHead>
              <TableHead scope="col">Teacher</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((schoolClass) => (
              <ClassRow key={schoolClass.id} directory={directory} schoolClass={schoolClass} run={run} />
            ))}
          </TableBody>
        </Table>
      )}
      {missing.length > 0 ? (
        <form
          className="grid gap-3 border-t border-border px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const result = run((current, context) => addClass(current, { sectionId: section.id, learningArea: area }, context));
            if (result.ok) setArea(NONE);
          }}
        >
          <Field>
            <FieldLabel htmlFor={`${headingId}-area`} className="text-meta">
              Add a class
            </FieldLabel>
            <Select
              items={[{ value: NONE, label: "Choose a learning area" }, ...missing.map((value) => ({ value, label: value }))]}
              value={area}
              onValueChange={(value) => setArea(String(value ?? NONE))}
            >
              <SelectTrigger id={`${headingId}-area`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Choose a learning area</SelectItem>
                {missing.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" variant="outline" disabled={area === NONE}>
            Add class
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function ClassRow({ directory, schoolClass, run }: { directory: Directory; schoolClass: SchoolClass; run: Run }) {
  const [teacherId, setTeacherId] = useState(NONE);
  const [editing, setEditing] = useState(false);
  const current = activeAssignment(directory, schoolClass.id);
  const teacher = current ? findAccount(directory, current.teacherId) : undefined;
  const label = classLabel(directory, schoolClass);
  const pickerId = `teacher-for-${schoolClass.id}`;

  return (
    <TableRow>
      <TableHead scope="row" className="align-top text-body font-medium text-foreground">
        {schoolClass.learningArea}
      </TableHead>
      <TableCell className="align-top">
        {teacher && !editing ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={adminRoutes.person(teacher.id)} className="text-primary underline-offset-4 hover:underline">
              {fullName(teacher)}
            </Link>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Change teacher for ${label}`}>
                Change
              </Button>
              <ConfirmDialog
                trigger={<Button variant="ghost" size="sm" aria-label={`Unassign teacher from ${label}`} />}
                triggerLabel="Unassign"
                title={`Unassign ${fullName(teacher)} from ${label}?`}
                description="The class will have no teacher, so nobody will see its learners' records until you assign one."
                confirmLabel="Unassign"
                onConfirm={() => run((state, context) => unassignTeacher(state, schoolClass.id, context))}
                focusAfterId={HEADING_ID}
              />
            </div>
          </div>
        ) : (
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const result = run((state, context) => assignTeacher(state, { classId: schoolClass.id, teacherId }, context));
              if (result.ok) {
                setTeacherId(NONE);
                setEditing(false);
              }
            }}
          >
            {!teacher ? <p className="text-meta font-medium text-destructive sm:col-span-2">No teacher assigned</p> : null}
            <TeacherPicker
              id={pickerId}
              label={teacher ? `Replace ${fullName(teacher)} with` : "Assign a teacher"}
              directory={directory}
              value={teacherId}
              onChange={setTeacherId}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={teacherId === NONE}>
                Assign
              </Button>
              {editing ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </TableCell>
    </TableRow>
  );
}
