import { LibraryBig } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "../routes";

/** A missing or unknown module is a normal state, not an error. */
export function ModuleNotFound() {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <span aria-hidden="true" className="grid size-12 place-content-center rounded-lg bg-surface-muted text-primary">
        <LibraryBig className="size-6" />
      </span>
      <h1 className="text-page font-semibold">Module not found on this device</h1>
      <p className="max-w-[52ch] text-muted-foreground">
        This module is not stored here. It may have been removed, or the link may be incomplete.
      </p>
      <Link href={routes.library()} className={buttonVariants({ variant: "outline", className: "mt-3" })}>
        Back to the library
      </Link>
    </div>
  );
}
