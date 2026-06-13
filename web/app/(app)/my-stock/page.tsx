"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Layers, Package } from "lucide-react";

import { InventoryTable } from "../inventory/components/inventory-table";
import type { InventoryStatusFilter } from "../inventory/components/inventory-toolbar";
import { StatCard } from "../dashboard/components/stat-card";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { useCategories } from "@/hooks/categories/use-categories";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAppStore } from "@/store/app";
import type { InventoryListScope } from "@/types/inventory/inventory";

function scopeForStatus(status: InventoryStatusFilter): InventoryListScope {
  if (status === "Low") return "low-stock";
  if (status === "Out") return "out-of-stock";
  return "all";
}

const STATUS_ITEMS: { value: InventoryStatusFilter; label: string }[] = [
  { value: "All", label: "All status" },
  { value: "Low", label: "Low stock" },
  { value: "Out", label: "Out of stock" },
];

export default function MyStockPage() {
  const user = useAppStore((s) => s.user);
  const label = user?.store?.split(" — ")[0] ?? "My Store";

  const [status, setStatus] = useState<InventoryStatusFilter>("All");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const debouncedSearch = useDebouncedValue(search, 300);

  const scope = scopeForStatus(status);
  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
    }),
    [pageIndex, pageSize, debouncedSearch, categoryId],
  );

  const summaryQuery = useMemo(
    () => ({
      page: 1,
      limit: 100,
      search: debouncedSearch || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
    }),
    [debouncedSearch, categoryId],
  );

  const { data: categories = [] } = useCategories();
  const { data, isPending, isFetching, isError, error } = useInventory(
    listQuery,
    scope,
  );
  const { data: summaryData } = useInventory(summaryQuery, scope);
  const { data: lowStockData } = useInventory(
    { page: 1, limit: 1 },
    "low-stock",
  );

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading = isPending || (isFetching && (data?.data.length ?? 0) === 0);

  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [categories],
  );

  const totalUnits = (summaryData?.data ?? []).reduce(
    (sum, row) => sum + row.quantity,
    0,
  );
  const lowCount = lowStockData?.meta.total ?? 0;

  const resetPage = () => setPageIndex(0);

  return (
    <>
      <PageHeader
        title={`My Stock — ${label}`}
        desc="Read-only view of your store's inventory"
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load inventory."}
        </div>
      )}

      <div className="filterbar">
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
            setStatus((value as InventoryStatusFilter | undefined) ?? "All");
            resetPage();
          }}
          items={STATUS_ITEMS}
          placeholder="All status"
          className="min-w-[160px]"
        />
      </div>

      <div className="stat-grid grid-cols-3 mb-16">
        <StatCard
          icon={Package}
          color="violet"
          value={rowCount}
          label="Total Products"
        />
        <StatCard
          icon={Layers}
          color="teal"
          value={totalUnits.toLocaleString()}
          label="Total Units"
        />
        <StatCard
          icon={AlertTriangle}
          color="amber"
          value={lowCount}
          label="Low Stock Items"
          valueColor={lowCount > 0 ? "var(--status-amber)" : undefined}
        />
      </div>

      <InventoryTable
        rows={rows}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
          setPageIndex(nextPage);
          setPageSize(nextSize);
        }}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        searchPlaceholder="Search product…"
        hideStoreColumn
        hideStockValue
        hideUpdatedAt
      />
    </>
  );
}
