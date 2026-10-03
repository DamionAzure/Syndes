"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Section } from "../class-record-types";
import { sectionLabel } from "../class-record-source";

export const ALL_SECTIONS = "all";

export function SectionFilter({
  id,
  sections,
  value,
  onChange,
  allowAll = true,
}: {
  id: string;
  sections: readonly Section[];
  value: string;
  onChange: (sectionId: string) => void;
  allowAll?: boolean;
}) {
  const items = [
    ...(allowAll ? [{ value: ALL_SECTIONS, label: "All sections" }] : []),
    ...sections.map((section) => ({ value: section.id, label: sectionLabel(section) })),
  ];
  return (
    <Field>
      <FieldLabel htmlFor={id} className="text-meta">
        Section
      </FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(String(next ?? ALL_SECTIONS))}>
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
