"use client";

import { useCallback, useMemo, useState } from "react";

import { SaleDetailSheet } from "./components/sale-detail-sheet";
import { SalesTable } from "./components/sales-table";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryBar } from "@/components/ui/summary-bar";
import { useCategories } from "@/hooks/categories/use-categories";
import { useSales } from "@/hooks/sales/use-sales";
import { useStores } from "@/hooks/stores/list-stores";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getCurrentMonthRange } from "@/lib/filters/dates";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { listSales } from "@/service/sales/list-sales";
import type { Sale, SaleStatus } from "@/types/sales/sale";

const STATUS_ITEMS = [
  { value: "active", label: "Active" },
  { value: "corrected", label: "Corrected" },
] as const;

export default function SalesPage() {
  const defaultRange = useMemo(() => getCurrentMonthRange(), []);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [status, setStatus] = useState<SaleStatus | undefined>();
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      storeId: storeId || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      status,
      fromDate,
      toDate,
    }),
    [
      pageIndex,
      pageSize,
      debouncedSearch,
      storeId,
      categoryId,
      status,
      fromDate,
      toDate,
    ],
  );

  const { data: categories = [] } = useCategories();
  const { data: storesData } = useStores({ limit: 100 });
  const { data, isPending, isFetching, isError, error } = useSales(listQuery);

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading =
    isPending || (isFetching && (data?.data.length ?? 0) === 0);

  const storeItems = useMemo(
    () =>
      (storesData?.data ?? []).map((store) => ({
        value: store.id,
        label: store.name,
      })),
    [storesData],
  );

  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [categories],
  );

  const resetPage = () => setPageIndex(0);

  const pageRevenue = useMemo(
    () => rows.reduce((sum, row) => sum + toNumber(row.totalAmount), 0),
    [rows],
  );

  const pageUnits = useMemo(
    () => rows.reduce((sum, row) => sum + row.quantitySold, 0),
    [rows],
  );

  const handleExportAll = useCallback(async () => {
    const limit = 100;
    let page = 1;
    const exported: Sale[] = [];
    let totalPages = 1;

    do {
      const response = await listSales({
        page,
        limit,
        search: debouncedSearch || undefined,
        storeId: storeId || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        status,
        fromDate,
        toDate,
      });
      exported.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return exported;
  }, [debouncedSearch, storeId, categoryId, status, fromDate, toDate]);

  const toolbarExtra = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <DateRangePicker
        fromDate={fromDate}
        toDate={toDate}
        onChange={(range) => {
          setFromDate(range.fromDate);
          setToDate(range.toDate);
          resetPage();
        }}
      />
      <Combobox
        value={storeId}
        onValueChange={(value) => {
          setStoreId(value);
          resetPage();
        }}
        items={storeItems}
        placeholder="All stores"
        searchPlaceholder="Search stores…"
        emptyText="No stores found."
        clearOption={{ label: "All stores" }}
        className="min-w-[160px]"
      />
      <Combobox
        value={categoryId}
        onValueChange={(value) => {
          setCategoryId(value);
          resetPage();
        }}
        items={categoryItems}
        placeholder="All categories"
        searchPlaceholder="Search categories…"
        emptyText="No categories found."
        clearOption={{ label: "All categories" }}
        className="min-w-[160px]"
      />
      <Combobox
        value={status}
        onValueChange={(value) => {
          setStatus(value as SaleStatus | undefined);
          resetPage();
        }}
        items={[...STATUS_ITEMS]}
        placeholder="All statuses"
        searchPlaceholder="Search status…"
        emptyText="No statuses found."
        clearOption={{ label: "All statuses" }}
        className="min-w-[140px]"
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Sales"
        desc="Every recorded sale across all stores"
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load sales."}
        </div>
      )}

      <SummaryBar
        items={[
          { k: "Total Sales", v: `${rows.length} transactions` },
          {
            k: "Total Revenue",
            v: fmt(pageRevenue),
            color: "var(--brand-indigo)",
          },
          { k: "Total Units", v: `${pageUnits} sold` },
        ]}
      />

      <SalesTable
        rows={rows}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
          setPageIndex(nextPage);
          setPageSize(nextSize);
        }}
        isLoading={isLoading}
        onExportAll={handleExportAll}
        onView={setSelectedSale}
        toolbarExtra={toolbarExtra}
      />

      {selectedSale && (
        <SaleDetailSheet
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </>
  );
}
