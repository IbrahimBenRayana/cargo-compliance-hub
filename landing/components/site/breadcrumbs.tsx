import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbList, type Crumb } from "@/lib/schema";
import { ROUTES, UI_STRINGS, findRoute } from "@/lib/site";

/**
 * Crumbs for a path from the route registry: Home › Platform › ISF filing.
 * Tools are presented as resources (site-architecture §4.5). Unknown
 * segments need an explicit `leaf` label.
 */
export function crumbsFor(path: string, leaf?: string): Crumb[] {
  const crumbs: Crumb[] = [{ name: UI_STRINGS.breadcrumbRoot, href: "/" }];
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "tools") crumbs.push({ name: ROUTES.resources.crumb, href: ROUTES.resources.href });
  let acc = "";
  parts.forEach((part, i) => {
    acc += `/${part}`;
    const last = i === parts.length - 1;
    const route = findRoute(acc);
    if (last) crumbs.push({ name: leaf ?? route?.crumb ?? route?.label ?? part, href: acc });
    else if (route) crumbs.push({ name: route.crumb ?? route.label, href: acc });
  });
  return crumbs;
}

export type BreadcrumbsProps = {
  /** Current path, e.g. "/platform/isf-filing". */
  path: string;
  /** Label for the current page when it isn't in the registry (articles, authors). */
  leaf?: string;
  /** Explicit crumbs (overrides path). */
  items?: Crumb[];
  className?: string;
};

/** Visible breadcrumb trail + BreadcrumbList JSON-LD from the same data. */
export function Breadcrumbs({ path, leaf, items, className }: BreadcrumbsProps) {
  const crumbs = items ?? crumbsFor(path, leaf);
  return (
    <>
      <nav aria-label="Breadcrumb" className={cn("text-[13px]", className)}>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-tone-muted">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={c.href} className="inline-flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="font-medium text-tone-fg">
                    {c.name}
                  </span>
                ) : (
                  <>
                    <Link href={c.href} className="transition-colors hover:text-tone-fg">
                      {c.name}
                    </Link>
                    <ChevronRight aria-hidden className="size-3.5 opacity-60" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbList(crumbs)} />
    </>
  );
}
