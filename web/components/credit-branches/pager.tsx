import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Dim and disable while the next page is loading. */
  busy?: boolean;
  className?: string;
}

/** "Showing 21–40 of 134" with Previous / Next. Buttons only appear when there is more than one page. */
export function Pager({
  page,
  limit,
  total,
  onPageChange,
  busy = false,
  className,
}: Props) {
  if (total === 0) return null;

  const totalPages = Math.ceil(total / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3 text-sm",
        className,
      )}
    >
      <p className="text-muted-foreground" aria-live="polite">
        Showing{" "}
        <span className="num font-medium text-foreground">
          {from}–{to}
        </span>{" "}
        of <span className="num font-medium text-foreground">{total}</span>
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Page <span className="num text-foreground">{page}</span> of{" "}
            <span className="num text-foreground">{totalPages}</span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || busy}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || busy}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
