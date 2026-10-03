import { OpenModuleFile } from "./open-module-file";

/** Shown on Home and in the Library when no Module is stored on this device. */
export function EmptyLibrary() {
  return (
    <section aria-labelledby="empty-library-heading" className="border-y border-border py-8">
      <h2 id="empty-library-heading" className="text-section font-semibold">
        No modules on this device yet
      </h2>
      <p className="mt-2 max-w-[62ch] text-muted-foreground">
        Modules your teacher prepares arrive as files. Open one to add it to your library.
      </p>
      <div className="mt-6">
        <OpenModuleFile />
      </div>
    </section>
  );
}
