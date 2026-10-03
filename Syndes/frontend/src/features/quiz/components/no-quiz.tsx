import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Module } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";

export function NoQuiz({ found }: { found: Module }) {
  return (
    <div className="mx-auto max-w-[56rem]">
      <h1 className="text-page font-semibold">This module has no quiz</h1>
      <p className="mt-3 text-muted-foreground">{found.title} is lessons only.</p>
      <Link href={routes.module(found.id)} className={buttonVariants({ variant: "outline", className: "mt-6" })}>
        Back to the module
      </Link>
    </div>
  );
}
