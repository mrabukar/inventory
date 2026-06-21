"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { InventoryGrid } from "../inventory/components/inventory-grid";
import { InventoryPagination } from "../inventory/components/inventory-pagination";
import { InventoryTable } from "../inventory/components/inventory-table";
import {
  InventoryToolbar,
  type InventoryView,
} from "../inventory/components/inventory-toolbar";
import { WarehouseWriteOffModal } from "./components/warehouse-write-off-modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/categories/use-categories";
import { useWriteOffWarehouseStock } from "@/hooks/inventory/use-write-off-warehouse-stock";
import { useWarehouseInventory } from "@/hooks/inventory/use-warehouse-inventory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listWarehouseInventory } from "@/service/inventory/list-warehouse-inventory";
import { useAppStore } from "@/store/app";
import type { Inventory } from "@/types/inventory/inventory";
import type { WarehouseStockWriteOffInput } from "@/service/inventory/write-off-warehouse-stock";

export default function WarehousePage() {
  const hasStores = useAppStore((s) => s.user?.hasStores ?? true);
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [view, setView] = useState<InventoryView>("table");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [writeOffRow, setWriteOffRow] = useState<Inventory | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
    }),
    [pageIndex, pageSize, debouncedSearch, categoryId],
  );

  const { data: categories = [] } = useCategories();
  const writeOffStock = useWriteOffWarehouseStock();
  const { data, isPending, isFetching, isError, error } =
    useWarehouseInventory(listQuery);

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading =
    isPending || (isFetching && (data?.data.length ?? 0) === 0);

  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [categories],
  );

  const resetPage = () => setPageIndex(0);

  const handleWriteOff = async (input: WarehouseStockWriteOffInput) => {
    try {
      await writeOffStock.mutateAsync(input);
      addToast({ title: "Warehouse stock removed" });
      setWriteOffRow(null);
    } catch (err) {
      addErrorToast({
        title: "Failed to remove warehouse stock",
        sub: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleExportAll = useCallback(async () => {
    const limit = 100;
    let page = 1;
    const exported: Inventory[] = [];
    let totalPages = 1;

    do {
      const response = await listWarehouseInventory({
        page,
        limit,
        search: debouncedSearch || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
      });
      exported.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return exported;
  }, [debouncedSearch, categoryId]);

  return (
    <>
      <PageHeader
        title="Warehouse"
        desc={
          hasStores
            ? "Central stock pool — purchased goods before distribution to stores"
            : "Organization stock — all inventory is held in the warehouse"
        }
        action={
          hasStores ? (
            <Button variant="outline" asChild>
              <Link href="/purchases">Record purchase</Link>
            </Button>
          ) : undefined
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load warehouse."}
        </div>
      )}

      <InventoryToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        storeId={undefined}
        onStoreIdChange={() => undefined}
        storeItems={[]}
        showStoreFilter={false}
        categoryId={categoryId}
        onCategoryIdChange={(value) => {
          setCategoryId(value);
          resetPage();
        }}
        categoryItems={categoryItems}
        status="All"
        onStatusChange={() => undefined}
        view={view}
        onViewChange={setView}
        showStatusFilter={false}
      />

      {view === "table" ? (
        <InventoryTable
          rows={rows}
          rowCount={rowCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          hideStoreColumn
          onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
            setPageIndex(nextPage);
            setPageSize(nextSize);
          }}
          isLoading={isLoading}
          onExportAll={handleExportAll}
          onWriteOffStock={(row) => setWriteOffRow(row)}
        />
      ) : (
        <>
          <InventoryGrid rows={rows} isLoading={isLoading} hideStore />
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

      <WarehouseWriteOffModal
        open={writeOffRow !== null}
        row={writeOffRow}
        onClose={() => setWriteOffRow(null)}
        onSave={(input) => void handleWriteOff(input)}
        isSaving={writeOffStock.isPending}
      />
    </>
  );
}
