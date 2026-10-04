"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACTIVITY_LABEL, findAccount, fullName, timestampLabel } from "../directory";
import type { ActivityAction, ActivityEntry, Directory } from "../directory-types";
import { adminRoutes } from "../routes";
import { currentAdministratorId, useDirectory } from "../use-directory";

const ALL = "all";

function actorName(directory: Directory, entry: ActivityEntry): string {
  if (entry.actorId === currentAdministratorId()) return "You";
  const actor = findAccount(directory, entry.actorId);
  return actor ? fullName(actor) : "Unknown";
}

/** Who changed what, and when. Entries are never edited or removed. */
export function ActivityView() {
  const directory = useDirectory();
  const [action, setAction] = useState<string>(ALL);
  const actions = Object.keys(ACTIVITY_LABEL) as ActivityAction[];
  const items = [{ value: ALL, label: "All changes" }, ...actions.map((value) => ({ value, label: ACTIVITY_LABEL[value] }))];
  const shown = directory.activity.filter((entry) => action === ALL || entry.action === action);

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-[18rem_minmax(0,1fr)] sm:items-end">
        <Field>
          <FieldLabel htmlFor="activity-filter" className="text-meta">
            Show
          </FieldLabel>
          <Select items={items} value={action} onValueChange={(value) => setAction(String(value ?? ALL))}>
            <SelectTrigger id="activity-filter" className="w-full">
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
        <p role="status" className="text-meta text-muted-foreground sm:pb-3">
          {shown.length} {shown.length === 1 ? "change" : "changes"}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center text-muted-foreground">
          No changes of this kind yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table label="Access activity">
            <TableCaption>Newest first. Times are shown in this device&apos;s time zone.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">When</TableHead>
                <TableHead scope="col">Change</TableHead>
                <TableHead scope="col">Details</TableHead>
                <TableHead scope="col">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((entry) => {
                const subject = findAccount(directory, entry.subjectId);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{timestampLabel(entry.at)}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{ACTIVITY_LABEL[entry.action] ?? entry.action}</TableCell>
                    <TableCell className="min-w-[20rem] text-body">
                      {subject ? (
                        <Link href={adminRoutes.person(subject.id)} className="underline-offset-4 hover:text-primary hover:underline">
                          {entry.summary}
                        </Link>
                      ) : (
                        entry.summary
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{actorName(directory, entry)}</TableCell>
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
