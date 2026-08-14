"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { CorrectionSheet } from "@/components/sales/correction-sheet";
import { SalesHistoryTable } from "./components/sales-history-table";
import { useCorrectSale } from "@/hooks/sales/use-correct-sale";
import { useSales } from "@/hooks/sales/use-sales";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getLast30DaysRange } from "@/lib/filters/dates";
import { isSaleWithinCorrectionWindow } from "@/lib/sales/correction-window";
import { useAppStore } from "@/store/app";
import type { CorrectSaleItemInput } from "@/types/sales/create-sale";
import type { Sale, SaleStatus } from "@/types/sales/sale";

const STATUS_ITEMS = [
  { value: "active", label: "Active" },
  { value: "corrected", label: "Corrected" },
] as const;

export default function SalesHistoryPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);

  const defaultRange = useMemo(() => getLast30DaysRange(), []);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SaleStatus | undefined>();
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [correct, setCorrect] = useState<Sale | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const correctSale = useCorrectSale();

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      status,
      fromDate,
      toDate,
    }),
    [pageIndex, pageSize, debouncedSearch, status, fromDate, toDate],
  );

  const { data, isPending, isFetching, isError, error } = useSales(listQuery);

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading = isPending || (isFetching && (data?.data.length ?? 0) === 0);

  const handleCorrect = async (
    items: CorrectSaleItemInput[],
    reason: string,
  ) => {
    if (!correct) return;

    try {
      await correctSale.mutateAsync({
        id: correct.id,
        input: { items, reason },
      });
      const count = items.length;
      addToast({
        title: "Sale corrected",
        sub:
          count === 1
            ? `Updated 1 item to ${items[0].correctedQuantity} units`
            : `Updated ${count} items`,
      });
      setCorrect(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to correct sale",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const toolbarExtra = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <DateRangePicker
        fromDate={fromDate}
        toDate={toDate}
        onChange={({ fromDate: nextFrom, toDate: nextTo }) => {
          setFromDate(nextFrom);
          setToDate(nextTo);
          setPageIndex(0);
        }}
      />
      <Combobox
        value={status}
        onValueChange={(value) => {
          setStatus(value as SaleStatus | undefined);
          setPageIndex(0);
        }}
        items={[...STATUS_ITEMS]}
        placeholder="All status"
        clearOption={{ label: "All status" }}
        className="min-w-[140px]"
      />
    </div>
  );

  return (
    <>
      <PageHeader title="Sales History" desc="Your submitted sales" />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load sales."}
        </div>
      )}

      <SalesHistoryTable
        rows={rows}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPageIndex(0);
        }}
        onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
          setPageIndex(nextPage);
          setPageSize(nextSize);
        }}
        isLoading={isLoading}
        onCorrect={(sale) => {
          if (!isSaleWithinCorrectionWindow(sale.createdAt)) return;
          setCorrect(sale);
        }}
        toolbarExtra={toolbarExtra}
      />

      {correct && (
        <CorrectionSheet
          sale={correct}
          onClose={() => setCorrect(null)}
          onSave={handleCorrect}
          isSaving={correctSale.isPending}
        />
      )}
    </>
  );
}
