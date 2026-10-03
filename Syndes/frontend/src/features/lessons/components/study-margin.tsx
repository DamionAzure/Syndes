import { Availability } from "@/features/modules/components/availability";
import type { Lesson } from "@/features/modules/module-types";

/** Supporting notes kept out of the reading line, separated by rules. */
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
    <div className="grid gap-6 text-meta">
      <section className="border-b border-border pb-6">
        <h2 className="font-semibold text-body">Where you are</h2>
        <p className="mt-1 text-muted-foreground">{place}</p>
      </section>

      {lesson.remember?.length ? (
        <section className="border-b border-border pb-6">
          <h2 className="font-semibold text-body">Remember</h2>
          <ul className="mt-2 grid gap-2 text-muted-foreground">
            {lesson.remember.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {readyOffline ? (
        <section>
          <h2 className="font-semibold text-body">Available on this device</h2>
          <Availability readyOffline className="mt-2 text-muted-foreground" />
        </section>
      ) : null}
    </div>
  );
}
