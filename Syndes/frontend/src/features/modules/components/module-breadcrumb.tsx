import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { routes } from "../routes";

/** Modules › Module title › current page. */
export function ModuleBreadcrumb({
  moduleId,
  moduleTitle,
  current,
}: {
  moduleId: string;
  moduleTitle: string;
  current?: string;
}) {
  return (
    <Breadcrumb aria-label="Breadcrumb">
      <BreadcrumbList className="text-meta">
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={routes.library()} />}>Modules</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {current ? (
            <BreadcrumbLink render={<Link href={routes.module(moduleId)} />}>
              {moduleTitle}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{moduleTitle}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {current ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{current}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
