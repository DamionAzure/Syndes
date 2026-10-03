"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ACCESS_LABEL,
  accessStateOf,
  activeEnrollment,
  byFamilyName,
  classesTaughtBy,
  findSection,
  listName,
  sectionLabel,
  timestampLabel,
} from "../directory";
import type { AccessState, Account, Directory } from "../directory-types";
import { adminRoutes } from "../routes";
import { useDirectory } from "../use-directory";
import { AccessBadge } from "./access-badge";

const ALL = "all";

const FILTER_ORDER: AccessState[] = ["waiting", "learner", "teacher", "admin", "unenrolled", "removed"];

function placement(directory: Directory, account: Account, state: AccessState): string {
  if (state === "learner") {
    const enrollment = activeEnrollment(directory, account.id);
    const section = enrollment ? findSection(directory, enrollment.sectionId) : undefined;
    return section ? sectionLabel(section) : "No section";
  }
  if (state === "teacher") {
    const count = classesTaughtBy(directory, account.id).length;
    return count === 0 ? "No classes yet" : `${count} ${count === 1 ? "class" : "classes"}`;
  }
  if (state === "waiting") return `Signed in ${timestampLabel(account.joinedAt)}`;
  return "";
}

function isAccessState(value: string | null): value is AccessState {
  return FILTER_ORDER.some((state) => state === value);
}

/** Everyone with an account, filterable by what they can do now. The filter lives in the URL. */
export function PeopleView() {
  const directory = useDirectory();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  const requested = searchParams.get("access");
  const access: AccessState | typeof ALL = isAccessState(requested) ? requested : ALL;
  const people = directory.accounts.map((account) => ({ account, state: accessStateOf(directory, account) }));
  const counts = new Map<AccessState, number>();
  for (const { state } of people) counts.set(state, (counts.get(state) ?? 0) + 1);

  const needle = query.trim().toLowerCase();
  const shown = people
    .filter(({ state }) => access === ALL || state === access)
    .filter(
      ({ account }) =>
        !needle ||
        `${account.givenName} ${account.familyName} ${account.email} ${account.lrn ?? ""}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => byFamilyName(a.account, b.account));

  const items = [
    { value: ALL, label: `Everyone (${people.length})` },
    ...FILTER_ORDER.map((state) => ({ value: state, label: `${ACCESS_LABEL[state]} (${counts.get(state) ?? 0})` })),
  ];

  function setAccess(next: string) {
    router.replace(next === ALL ? pathname : `${pathname}?${new URLSearchParams({ access: next }).toString()}`, {
      scroll: false,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      <div
        role="search"
        aria-label="Find a person"
        className="grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2 lg:sticky lg:top-8 lg:grid-cols-1"
      >
        <Field>
          <FieldLabel htmlFor="people-search" className="text-meta">
            Name, email or LRN
          </FieldLabel>
          <Input id="people-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="people-access" className="text-meta">
            Access
          </FieldLabel>
          <Select items={items} value={access} onValueChange={(value) => setAccess(String(value ?? ALL))}>
            <SelectTrigger id="people-access" className="w-full">
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
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-2 lg:col-span-1">
          <p role="status" className="text-meta text-muted-foreground">
            {shown.length} {shown.length === 1 ? "person" : "people"}
          </p>
          {needle || access !== ALL ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setAccess(ALL);
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-section font-semibold">
            {access === "waiting" && !needle ? "Nobody is waiting for access" : "No one matches"}
          </h2>
          <p className="max-w-[52ch] text-muted-foreground">
            {access === "waiting" && !needle
              ? "New sign-ins appear here until you give them Teacher access or enroll them in a section."
              : "Check the spelling, or look at everyone."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table label="People">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col">Access</TableHead>
                <TableHead scope="col">Section or classes</TableHead>
                <TableHead scope="col">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map(({ account, state }) => (
                <TableRow key={account.id}>
                  <TableHead scope="row" className="text-body font-medium text-foreground">
                    <Link
                      href={adminRoutes.person(account.id)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {listName(account)}
                    </Link>
                  </TableHead>
                  <TableCell>
                    <AccessBadge state={state} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{placement(directory, account, state)}</TableCell>
                  <TableCell className="text-muted-foreground">{account.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
