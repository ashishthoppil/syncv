import type { Breadcrumb } from "@/lib/seo/schema";
import Link from "next/link";

/**
 * Visible breadcrumbs, paired with BreadcrumbList markup on the same page.
 * Google expects the markup to reflect something a user can actually see, and
 * they give every deep page a crawlable path back to its hub.
 *
 * The last crumb is the current page and is not a link.
 */
export function Breadcrumbs({ trail }: { trail: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {isLast ? (
                <span aria-current="page" className="text-foreground">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link href={crumb.path} className="hover:text-foreground hover:underline">
                    {crumb.name}
                  </Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
