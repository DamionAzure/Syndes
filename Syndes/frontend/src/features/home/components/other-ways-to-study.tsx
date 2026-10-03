import Link from "next/link";
import type { ModuleSummary } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";

const linkClass =
  "flex min-h-(--control-height) items-center justify-between gap-4 border-b border-border py-3 hover:text-primary";

/** Only links to things that exist on this device. */
export function OtherWaysToStudy({ modules }: { modules: ModuleSummary[] }) {
  const hasQuizzes = modules.some((summary) => summary.questionCount > 0);
  const decks = modules.filter((summary) => summary.hasFlashcards);
  if (!hasQuizzes && decks.length === 0) return null;

  return (
    <section aria-labelledby="other-ways-heading">
      <h2 id="other-ways-heading" className="text-section font-semibold">
        Other ways to study
      </h2>
      <ul className="mt-4 border-t border-border">
        {hasQuizzes ? (
          <li>
            <Link href={routes.quizzes()} className={linkClass}>
              <span>Quizzes</span>
              <span className="text-meta text-muted-foreground">Check what you remember</span>
            </Link>
          </li>
        ) : null}
        {decks.map((summary) => (
          <li key={summary.id}>
            <Link href={routes.flashcards(summary.id)} className={linkClass}>
              <span>Flashcards: {summary.title}</span>
              <span className="text-meta text-muted-foreground">Study key ideas</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
