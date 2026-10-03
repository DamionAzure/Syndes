import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Module } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";

/** Orientation, not navigation clutter: the real sequence with the current Lesson marked. */
export function ChapterRail({ found, current }: { found: Module; current: number }) {
  const total = found.lessons.length;
  const hasQuiz = (found.quiz?.questions.length ?? 0) > 0;

  return (
    <div className="grid gap-5">
      <div>
        <p className="font-semibold">{found.title}</p>
        <p className="text-meta text-muted-foreground">
          {total} {total === 1 ? "lesson" : "lessons"}
          {hasQuiz ? ", then a short quiz" : ""}
        </p>
      </div>

      <ol className="grid gap-1">
        {found.lessons.map((lesson, index) => {
          const number = index + 1;
          const isCurrent = number === current;
          return (
            <li key={lesson.id}>
              <Link
                href={routes.lesson(found.id, number)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "grid min-h-(--control-height) grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-meta text-muted-foreground hover:bg-surface hover:text-foreground",
                  isCurrent && "bg-surface font-semibold text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 place-content-center rounded-md border border-border text-meta tabular-nums",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {number}
                </span>
                <span>{lesson.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {hasQuiz ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-2">
          <p className="text-meta text-muted-foreground">After lesson {total}</p>
          <p className="text-meta font-medium">Short quiz</p>
        </div>
      ) : null}
    </div>
  );
}
