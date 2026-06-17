"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SalesHistoryTable } from "./components/sales-history-table";
import { useCorrectSale } from "@/hooks/sales/use-correct-sale";
import { useSales } from "@/hooks/sales/use-sales";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getLast30DaysRange } from "@/lib/filters/dates";
import { formatProductLabel } from "@/lib/products/format";
import { formatSaleDate } from "@/lib/reports/format";
import { useAppStore } from "@/store/app";
import type { Sale, SaleStatus } from "@/types/sales/sale";

const STATUS_ITEMS = [
  { value: "active", label: "Active" },
  { value: "corrected", label: "Corrected" },
] as const;

function CorrectionSheet({
  sale,
  onClose,
  onSave,
  isSaving,
}: {
  sale: Sale;
  onClose: () => void;
  onSave: (qty: number, reason: string) => void;
  isSaving: boolean;
}) {
  const [qty, setQty] = useState(String(sale.quantitySold));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<{ qty?: string; reason?: string }>({});

  const save = () => {
    const e: typeof err = {};
    const parsed = qty === "" ? NaN : parseInt(qty, 10);
    if (qty === "" || Number.isNaN(parsed) || parsed < 0)
      e.qty = "Enter a valid whole number";
    if (!reason.trim()) e.reason = "Reason is required";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave(parsed, reason.trim());
  };

  return (
    <Sheet
      title="Correct Sale"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? "Submitting…" : "Submit Correction"}
          </Button>
        </>
      }
    >
      <div
        className="readout"
        style={{
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 6,
          marginBottom: 18,
        }}
      >
        <div>
          <b>{formatProductLabel(sale.product.name, sale.product.model)}</b>
        </div>
        <div>
          Original quantity: <b>{sale.quantitySold}</b>
        </div>
        <div>Sale date: {formatSaleDate(sale.saleDate)}</div>
      </div>
      <Field label="Corrected quantity" required error={err.qty}>
        <input
          className={`f-input${err.qty ? " error" : ""}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={qty}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "") {
              setQty("");
              return;
            }
            setQty(next.replace(/\D/g, ""));
          }}
        />
      </Field>
      <Field label="Reason" required error={err.reason}>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this sale is being corrected"
        />
      </Field>
    </Sheet>
  );
}

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

  const handleCorrect = async (qty: number, reason: string) => {
    if (!correct) return;

    try {
      await correctSale.mutateAsync({
        id: correct.id,
        input: { correctedQuantity: qty, reason },
      });
      addToast({
        title: "Sale corrected",
        sub: `${formatProductLabel(correct.product.name, correct.product.model)} → ${qty} units`,
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
        onCorrect={setCorrect}
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
