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

  return (
    <div className="mx-auto max-w-[72rem]">
      {modules.length === 0 ? (
        <div className="mt-10">
          <EmptyLibrary />
        </div>
      ) : (
        <>
          <div
            role="search"
            className="mt-10 grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end"
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
          </div>

          <p role="status" className="mt-8 text-meta text-muted-foreground">
            {results.length} {results.length === 1 ? "module" : "modules"}
          </p>

          {results.length === 0 ? (
            <div className="mt-4 border-y border-border py-8">
              <h2 className="text-section font-semibold">No modules match</h2>
              <p className="mt-2 text-muted-foreground">Try another search or subject.</p>
              <Button variant="outline" className="mt-6" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <ul className="mt-2 grid border-t border-border min-[72rem]:grid-cols-2 min-[72rem]:gap-x-10">
              {results.map((summary) => (
                <ModuleRow key={summary.id} summary={summary} headingLevel="h2" />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
