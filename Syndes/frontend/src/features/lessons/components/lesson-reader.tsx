import Link from "next/link";
import type { Ref } from "react";
import { buttonVariants } from "@/components/ui/button";
import { StepProgress } from "@/components/ui/step-progress";
import type { Lesson } from "@/features/modules/module-types";

export type LessonNavLink = { href: string; label: string };

export function LessonReader({
  lesson,
  place,
  number,
  total,
  previous,
  next,
  headingRef,
}: {
  lesson: Lesson;
  place: string;
  number: number;
  total: number;
  previous: LessonNavLink;
  next: LessonNavLink;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  return (
    <article>
      <StepProgress current={number} total={total} label={place} className="max-w-[20rem]" />
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-page font-semibold text-balance sm:text-title">
        {lesson.title}
      </h1>
      {lesson.subtitle ? (
        <p className="mt-3 max-w-[62ch] text-muted-foreground">{lesson.subtitle}</p>
      ) : null}

      <div className="mt-8 grid gap-10 border-t border-border pt-8">
        {lesson.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-section font-semibold">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-4 max-w-[62ch] leading-[1.7]">
                {paragraph}
              </p>
            ))}
            {section.tryThis?.length ? (
              <aside aria-label="Try this" className="mt-6 max-w-[62ch] rounded-lg border border-primary/30 bg-surface-muted/60 px-5 py-4">
                <p className="text-meta font-semibold text-primary">Try this</p>
                {section.tryThis.map((line) => (
                  <p key={line} className="mt-2 leading-[1.7]">
                    {line}
                  </p>
                ))}
              </aside>
            ) : null}
          </section>
        ))}
      </div>

      <nav
        aria-label="Lesson navigation"
        className="mt-12 flex flex-wrap justify-between gap-4 border-t border-border pt-6"
      >
        <Link href={previous.href} className={buttonVariants({ variant: "outline" })}>
          {previous.label}
        </Link>
        <Link href={next.href} className={buttonVariants()}>
          {next.label}
        </Link>
      </nav>
    </article>
  );
}
