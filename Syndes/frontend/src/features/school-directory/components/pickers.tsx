"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { activeAssignment, classLabel, findAccount, fullName, learnersIn, sectionLabel, sortedSections } from "../directory";
import type { Directory } from "../directory-types";

export const NONE = "none";

type Item = { value: string; label: string };

function Picker({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string;
  label: string;
  items: Item[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="text-meta">
        {label}
      </FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(String(next ?? NONE))}>
        <SelectTrigger id={id} className="w-full">
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
  );
}

/** Sections in school order, each with its current size so the Administrator can balance them. */
export function SectionPicker({
  id,
  label,
  directory,
  value,
  onChange,
  excludeId,
}: {
  id: string;
  label: string;
  directory: Directory;
  value: string;
  onChange: (sectionId: string) => void;
  excludeId?: string;
}) {
  const items: Item[] = [
    { value: NONE, label: "Choose a section" },
    ...sortedSections(directory)
      .filter((section) => section.id !== excludeId)
      .map((section) => ({
        value: section.id,
        label: `${sectionLabel(section)} (${learnersIn(directory, section.id).length} learners)`,
      })),
  ];
  return <Picker id={id} label={label} items={items} value={value} onChange={onChange} />;
}

/** Every class, saying who teaches it now, so a replacement is never a surprise. */
export function ClassPicker({
  id,
  label,
  directory,
  value,
  onChange,
  excludeTeacherId,
}: {
  id: string;
  label: string;
  directory: Directory;
  value: string;
  onChange: (classId: string) => void;
  excludeTeacherId?: string;
}) {
  const order = new Map(sortedSections(directory).map((section, index) => [section.id, index]));
  const items: Item[] = [
    { value: NONE, label: "Choose a class" },
    ...directory.classes
      .filter((schoolClass) => activeAssignment(directory, schoolClass.id)?.teacherId !== excludeTeacherId)
      .sort(
        (a, b) =>
          (order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0) || a.learningArea.localeCompare(b.learningArea),
      )
      .map((schoolClass) => {
        const current = activeAssignment(directory, schoolClass.id);
        const teacher = current ? findAccount(directory, current.teacherId) : undefined;
        return {
          value: schoolClass.id,
          label: `${classLabel(directory, schoolClass)}, ${teacher ? `taught by ${fullName(teacher)}` : "no teacher"}`,
        };
      }),
  ];
  return <Picker id={id} label={label} items={items} value={value} onChange={onChange} />;
}

/** Accounts with Teacher access, for assigning a class from the Sections page. */
export function TeacherPicker({
  id,
  label,
  directory,
  value,
  onChange,
}: {
  id: string;
  label: string;
  directory: Directory;
  value: string;
  onChange: (teacherId: string) => void;
}) {
  const items: Item[] = [
    { value: NONE, label: "Choose a teacher" },
    ...directory.accounts
      .filter((account) => account.role === "teacher" && account.status === "active")
      .sort((a, b) => a.familyName.localeCompare(b.familyName))
      .map((account) => ({ value: account.id, label: fullName(account) })),
  ];
  return <Picker id={id} label={label} items={items} value={value} onChange={onChange} />;
}
