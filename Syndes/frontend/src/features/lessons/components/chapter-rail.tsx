import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Module } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";

/** Orientation, not navigation clutter: the real sequence with the current Lesson marked. */
export function ChapterRail({ found, current }: { found: Module; current: number }) {
  const total = found.lessons.length;
  const hasQuiz = (found.quiz?.questions.length ?? 0) > 0;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="border-b border-border pb-4">
        <p className="font-semibold">{found.title}</p>
        <p className="text-meta text-muted-foreground">
          {total} {total === 1 ? "lesson" : "lessons"}
          {hasQuiz ? " / short quiz" : ""}
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
                  "grid min-h-(--control-height) grid-cols-[2rem_minmax(0,1fr)] items-center rounded-sm border-l-2 border-transparent px-3 text-meta text-muted-foreground hover:text-foreground",
                  isCurrent && "border-primary bg-background font-semibold text-foreground",
                )}
              >
                <span className="tabular-nums">{String(number).padStart(2, "0")}</span>
                <span>{lesson.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {hasQuiz ? (
        <div className="border-t border-border pt-4">
          <p className="text-meta text-muted-foreground">After lesson {total}</p>
          <p>Short quiz</p>
        </div>
      ) : null}
    </div>
  );
}
