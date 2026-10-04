import { Availability } from "@/features/modules/components/availability";
import type { Lesson } from "@/features/modules/module-types";

function MarginNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-surface-muted/60 p-4">
      <h2 className="text-body font-semibold">{title}</h2>
      <div className="mt-1 text-meta text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * Supporting notes kept out of the reading line. Beside the page on wide
 * screens; a row of notes under it when the margin drops below.
 */
export function StudyMargin({
  lesson,
  place,
  readyOffline,
}: {
  lesson: Lesson;
  place: string;
  readyOffline: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1">
      <MarginNote title="Where you are">
        <p>{place}</p>
      </MarginNote>

      {lesson.remember?.length ? (
        <MarginNote title="Remember">
          <ul className="grid gap-2">
            {lesson.remember.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </MarginNote>
      ) : null}

      {readyOffline ? (
        <MarginNote title="Available on this device">
          <Availability readyOffline />
        </MarginNote>
      ) : null}
    </div>
  );
}
