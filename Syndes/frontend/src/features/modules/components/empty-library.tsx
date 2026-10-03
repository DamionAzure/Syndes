import { LibraryBig } from "lucide-react";
import { OpenModuleFile } from "./open-module-file";

/** Shown on Home and in the Library when no Module is stored on this device. */
export function EmptyLibrary() {
  return (
    <section
      aria-labelledby="empty-library-heading"
      className="grid justify-items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center"
    >
      <span aria-hidden="true" className="grid size-12 place-content-center rounded-lg bg-surface-muted text-primary">
        <LibraryBig className="size-6" />
      </span>
      <h2 id="empty-library-heading" className="text-section font-semibold">
        No modules on this device yet
      </h2>
      <p className="max-w-[48ch] text-muted-foreground">
        Modules your teacher prepares arrive as files. Open one to add it to your library.
      </p>
      <div className="mt-3">
        <OpenModuleFile variant="default" />
      </div>
    </section>
  );
}
