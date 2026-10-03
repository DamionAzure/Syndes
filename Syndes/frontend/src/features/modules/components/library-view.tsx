"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModules } from "../module-source";
import type { ModuleSummary } from "../module-types";
import { EmptyLibrary } from "./empty-library";
import { ModuleRow } from "./module-row";

const ALL_SUBJECTS = "all";

function matches(summary: ModuleSummary, query: string, subject: string) {
  const inSubject = subject === ALL_SUBJECTS || summary.subject === subject;
  const needle = query.trim().toLowerCase();
  const inText =
    needle === "" ||
    [summary.title, summary.subject, summary.summary].some((text) =>
      text.toLowerCase().includes(needle),
    );
  return inSubject && inText;
}

export function LibraryView() {
  const modules = useModules();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The field keeps its own state so fast typing never loses keystrokes to a
  // lagging URL; Back and Forward bring it back in step with the URL.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  useEffect(() => {
    const onPopState = () => setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const subjects = [...new Set(modules.map((summary) => summary.subject))].sort();
  const requestedSubject = searchParams.get("subject") ?? ALL_SUBJECTS;
  const subject = subjects.includes(requestedSubject) ? requestedSubject : ALL_SUBJECTS;
  const results = modules.filter((summary) => matches(summary, query, subject));
  const subjectItems = [
    { value: ALL_SUBJECTS, label: "All subjects" },
    ...subjects.map((name) => ({ value: name, label: name })),
  ];

  // Search and filter live in the URL so a filtered Library is linkable.
  function setParam(name: "q" | "subject", value: string, empty: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === empty) next.delete(name);
    else next.set(name, value);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  function clearFilters() {
    setQuery("");
    router.replace(pathname, { scroll: false });
  }

  if (modules.length === 0) return <EmptyLibrary />;

  const filtered = query.trim() !== "" || subject !== ALL_SUBJECTS;

  // Filters stay beside the results on wide screens and above them on narrow ones.
  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      <div
        role="search"
        aria-label="Find a module"
        className="grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2 lg:sticky lg:top-8 lg:grid-cols-1"
      >
            <Field>
              <FieldLabel htmlFor="module-search" className="text-meta">
                Search modules
              </FieldLabel>
              <Input
                id="module-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setParam("q", event.target.value, "");
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="subject-filter" className="text-meta">
                Subject
              </FieldLabel>
              <Select
                items={subjectItems}
                value={subject}
                onValueChange={(value) => setParam("subject", String(value ?? ALL_SUBJECTS), ALL_SUBJECTS)}
              >
                <SelectTrigger id="subject-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-2 lg:col-span-1">
          <p role="status" className="text-meta text-muted-foreground">
            {results.length} {results.length === 1 ? "module" : "modules"}
          </p>
          {filtered ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-section font-semibold">No modules match</h2>
          <p className="text-muted-foreground">Try another search or subject.</p>
          <Button variant="outline" className="mt-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <ul aria-label="Modules" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {results.map((summary) => (
            <ModuleRow key={summary.id} summary={summary} headingLevel="h2" />
          ))}
        </ul>
      )}
    </div>
  );
}
