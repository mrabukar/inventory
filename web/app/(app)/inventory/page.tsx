"use client";

import { useCallback, useMemo, useState } from "react";

import { InventoryGrid } from "./components/inventory-grid";
import { InventoryPagination } from "./components/inventory-pagination";
import { InventoryTable } from "./components/inventory-table";
import {
  InventoryToolbar,
  type InventoryStatusFilter,
  type InventoryView,
} from "./components/inventory-toolbar";
import { PageHeader } from "@/components/ui/page-header";
import { useCategories } from "@/hooks/categories/use-categories";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { useStores } from "@/hooks/stores/list-stores";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listInventory } from "@/service/inventory/list-inventory";
import { useAppStore } from "@/store/app";
import type { Inventory, InventoryListScope } from "@/types/inventory/inventory";

function scopeForStatus(status: InventoryStatusFilter): InventoryListScope {
  if (status === "Low") return "low-stock";
  if (status === "Out") return "out-of-stock";
  return "all";
}

export default function InventoryPage() {
  const hasStores = useAppStore((s) => s.user?.hasStores ?? true);
  const [view, setView] = useState<InventoryView>("table");
  const [status, setStatus] = useState<InventoryStatusFilter>("All");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const debouncedSearch = useDebouncedValue(search, 300);

  const scope = scopeForStatus(status);
  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      categoryId: categoryId || undefined,
      storeId: storeId || undefined,
    }),
    [pageIndex, pageSize, debouncedSearch, categoryId, storeId],
  );

  const { data: categories = [] } = useCategories();
  const { data: storesData } = useStores({ limit: 100 });
  const { data, isPending, isFetching, isError, error } = useInventory(
    listQuery,
    scope,
  );

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

  const handleExportAll = useCallback(async () => {
    const limit = 100;
    let page = 1;
    const exported: Inventory[] = [];
    let totalPages = 1;

    do {
      const response = await listInventory(
        {
          page,
          limit,
          search: debouncedSearch || undefined,
          categoryId: categoryId || undefined,
          storeId: storeId || undefined,
        },
        scope,
      );
      exported.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return exported;
  }, [debouncedSearch, categoryId, storeId, scope]);

  return (
    <>
      <PageHeader
        title="Inventory"
        desc={
          hasStores
            ? "Live stock levels at branch stores"
            : "Branch store stock — organization-wide stock is on the Warehouse page"
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load inventory."}
        </div>
      )}

      <InventoryToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        storeId={storeId}
        onStoreIdChange={(value) => {
          setStoreId(value);
          resetPage();
        }}
        storeItems={storeItems}
        showStoreFilter={hasStores}
        categoryId={categoryId}
        onCategoryIdChange={(value) => {
          setCategoryId(value);
          resetPage();
        }}
        categoryItems={categoryItems}
        status={status}
        onStatusChange={(value) => {
          setStatus(value);
          resetPage();
        }}
        view={view}
        onViewChange={setView}
      />

      {view === "table" ? (
        <InventoryTable
          rows={rows}
          rowCount={rowCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          hideStoreColumn={!hasStores}
          onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
            setPageIndex(nextPage);
            setPageSize(nextSize);
          }}
          isLoading={isLoading}
          onExportAll={handleExportAll}
        />
      ) : (
        <>
          <InventoryGrid rows={rows} isLoading={isLoading} hideStore={!hasStores} />
          <div
            className="table-wrap"
            style={{ marginTop: rows.length ? 16 : 0 }}
          >
            <InventoryPagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              total={rowCount}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPageIndex(0);
              }}
            />
          </div>
        </>
      )}
    </>
  );
}
