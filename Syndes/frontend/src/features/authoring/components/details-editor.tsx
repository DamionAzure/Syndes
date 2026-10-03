"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fieldIds } from "../draft-checks";
import type { ModuleDraft } from "../draft-types";
import type { EditDraft } from "./item-controls";

const NOT_SET = "not-set";

const GRADE_LEVELS = [
  { value: NOT_SET, label: "Not set" },
  { value: "Kindergarten", label: "Kindergarten" },
  ...Array.from({ length: 12 }, (_, index) => ({ value: `Grade ${index + 1}`, label: `Grade ${index + 1}` })),
];

export function DetailsEditor({ draft, edit }: { draft: ModuleDraft; edit: EditDraft }) {
  return (
    <div className="grid gap-6">
      <Field>
        <FieldLabel htmlFor={fieldIds.title}>Title</FieldLabel>
        <Input
          id={fieldIds.title}
          value={draft.title}
          onChange={(event) => edit((current) => ({ ...current, title: event.target.value }))}
          placeholder="For example, How plants make food"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={fieldIds.subject}>Subject</FieldLabel>
          <Input
            id={fieldIds.subject}
            value={draft.subject}
            onChange={(event) => edit((current) => ({ ...current, subject: event.target.value }))}
            placeholder="For example, Science"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="draft-grade-level">Grade level</FieldLabel>
          <Select
            items={GRADE_LEVELS}
            value={draft.gradeLevel || NOT_SET}
            onValueChange={(value) =>
              edit((current) => ({ ...current, gradeLevel: value === NOT_SET || value === null ? "" : String(value) }))
            }
          >
            <SelectTrigger id="draft-grade-level" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRADE_LEVELS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Shown to Learners. It never changes how answers are checked.</FieldDescription>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="draft-summary">Summary</FieldLabel>
        <Textarea
          id="draft-summary"
          value={draft.summary}
          onChange={(event) => edit((current) => ({ ...current, summary: event.target.value }))}
          aria-describedby="draft-summary-hint"
        />
        <FieldDescription id="draft-summary-hint">
          One or two sentences Learners read before they start.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="draft-outcomes">Learning outcomes</FieldLabel>
        <Textarea
          id="draft-outcomes"
          value={draft.outcomes}
          onChange={(event) => edit((current) => ({ ...current, outcomes: event.target.value }))}
          aria-describedby="draft-outcomes-hint"
          placeholder={"Explain what a leaf takes in\nDescribe the role of chlorophyll"}
        />
        <FieldDescription id="draft-outcomes-hint">
          One per line. Start each with what the Learner will be able to do.
        </FieldDescription>
      </Field>
    </div>
  );
}
