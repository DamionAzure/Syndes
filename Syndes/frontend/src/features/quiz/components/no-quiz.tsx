import { ListChecks } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Module } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";

export function NoQuiz({ found }: { found: Module }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <span aria-hidden="true" className="grid size-12 place-content-center rounded-lg bg-surface-muted text-primary">
        <ListChecks className="size-6" />
      </span>
      <h1 className="text-page font-semibold">This module has no quiz</h1>
      <p className="text-muted-foreground">{found.title} is lessons only.</p>
      <Link href={routes.module(found.id)} className={buttonVariants({ variant: "outline", className: "mt-3" })}>
        Back to the module
      </Link>
    </div>
  );
}
