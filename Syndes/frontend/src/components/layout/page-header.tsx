import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  /** The sidebar icon of the section this page belongs to, repeated for wayfinding. */
  icon?: LucideIcon;
  description?: ReactNode;
  /** Where this page sits, e.g. a breadcrumb; rendered above the title. */
  context?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
};

/**
 * Every page opens the same way: section icon, title, one line of
 * orientation, and the page's main actions on the right. It renders without
 * hooks, so routes can prerender it as static HTML.
 */
export function PageHeader({ title, icon: Icon, description, context, actions, id, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8 border-b border-border pb-6", className)}>
      {context ? <div className="mb-4">{context}</div> : null}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {Icon ? (
            <span
              aria-hidden="true"
              className="mt-1 hidden size-11 shrink-0 place-content-center rounded-lg bg-surface-muted text-primary sm:grid"
            >
              <Icon className="size-6" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 id={id} tabIndex={-1} className="text-page font-semibold text-balance">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-[62ch] text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
