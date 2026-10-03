import { Layers, ListChecks, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModuleSummary } from "@/features/modules/module-types";
import { routes } from "@/features/modules/routes";

function StudyLink({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-(--control-height) items-center gap-3 px-6 py-3 hover:bg-surface-muted"
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-content-center rounded-lg bg-surface-muted text-primary">
          <Icon className="size-5" />
        </span>
        <span className="grid min-w-0">
          <span className="font-medium">{title}</span>
          <span className="text-meta text-muted-foreground">{hint}</span>
        </span>
      </Link>
    </li>
  );
}

/** Only links to things that exist on this device. */
export function OtherWaysToStudy({ modules }: { modules: ModuleSummary[] }) {
  const hasQuizzes = modules.some((summary) => summary.questionCount > 0);
  const decks = modules.filter((summary) => summary.hasFlashcards);
  if (!hasQuizzes && decks.length === 0) return null;

  return (
    <Card className="gap-3 pb-3">
      <CardHeader>
        <CardTitle id="other-ways-heading">Other ways to study</CardTitle>
      </CardHeader>
      <ul aria-labelledby="other-ways-heading" className="grid">
        {hasQuizzes ? (
          <StudyLink href={routes.quizzes()} icon={ListChecks} title="Quizzes" hint="Check what you remember" />
        ) : null}
        {decks.map((summary) => (
          <StudyLink
            key={summary.id}
            href={routes.flashcards(summary.id)}
            icon={Layers}
            title={`Flashcards: ${summary.title}`}
            hint="Study key ideas"
          />
        ))}
      </ul>
    </Card>
  );
}
