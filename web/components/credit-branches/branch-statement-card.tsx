"use client";

import { useState } from "react";

import { Pager } from "./pager";
import { SortSelect } from "./sort-select";
import { StatementTable } from "./statement-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranchStatement } from "@/hooks/credit-branches/use-credit-branch";
import { cn } from "@/lib/utils";
import type { StatementOrder } from "@/types/credit-branches/credit-branch";

const PAGE_SIZE = 20;

const ORDER_OPTIONS: { value: StatementOrder; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

/**
 * A branch's statement, 20 entries at a time. Only date order is offered:
 * the Balance column is a running total, so sorting by any other column
 * would make it meaningless.
 */
export function BranchStatementCard({ branchId }: { branchId: string }) {
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<StatementOrder>("newest");

  const { data, isPending, isPlaceholderData, isError } = useBranchStatement(
    branchId,
    { page, limit: PAGE_SIZE, order },
  );

  return (
    <div className="card overflow-hidden">
      <div className="card-head">
        <h3>Statement</h3>
        <SortSelect
          label="Statement order"
          value={order}
          options={ORDER_OPTIONS}
          onChange={(next) => {
            setOrder(next);
            setPage(1);
          }}
        />
      </div>

      {isPending ? (
        <div className="grid gap-2 p-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="px-6 py-10 text-center text-sm text-destructive">
          Couldn&apos;t load the statement.
        </p>
      ) : (
        <>
          <div
            className={cn(
              "transition-opacity",
              isPlaceholderData && "opacity-60",
            )}
          >
            <StatementTable rows={data.rows} />
          </div>
          <Pager
            page={page}
            limit={PAGE_SIZE}
            total={data.meta.total}
            onPageChange={setPage}
            busy={isPlaceholderData}
          />
        </>
      )}
    </div>
  );
}
