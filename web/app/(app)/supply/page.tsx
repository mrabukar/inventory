"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";

import { SupplyDetailSheet } from "./components/supply-detail-sheet";
import {
  SupplyFixChooserModal,
  type SupplyFixMode,
} from "./components/supply-fix-chooser-modal";
import { SupplyFixModal } from "./components/supply-fix-modal";
import { SupplyModal } from "./components/supply-modal";
import { SupplyTable } from "./components/supply-table";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SummaryBar } from "@/components/ui/summary-bar";
import { useCategories } from "@/hooks/categories/use-categories";
import { useCreateStockCorrectionAdd } from "@/hooks/stock-supplies/use-create-stock-correction";
import { useCreateStockCorrectionSubtract } from "@/hooks/stock-supplies/use-create-stock-correction";
import { useCreateStockSupply } from "@/hooks/stock-supplies/use-create-stock-supply";
import { useStockSupplies } from "@/hooks/stock-supplies/use-stock-supplies";
import { useStores } from "@/hooks/stores/list-stores";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getCurrentMonthRange } from "@/lib/filters/dates";
import { fmt } from "@/lib/utils";
import { listStockSupplies } from "@/service/stock-supplies/list-stock-supplies";
import { useAppStore } from "@/store/app";
import {
  supplyInvestment,
  type CreateStockCorrectionInput,
  type CreateStockSupplyInput,
  type StockSupply,
  type StockSupplyType,
} from "@/types/stock-supplies/stock-supply";

const TYPE_ITEMS = [
  { value: "supply", label: "Supplies" },
  { value: "correction_add", label: "Fixes (added units)" },
  { value: "correction_subtract", label: "Fixes (removed units)" },
] as const;

interface FixChooserState {
  supply?: StockSupply;
}

interface FixFormState {
  mode: SupplyFixMode;
  supply?: StockSupply;
}

export default function SupplyPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const hasStores = useAppStore((s) => s.user?.hasStores ?? true);

  if (!hasStores) {
    return (
      <>
        <PageHeader
          title="Distribute to Store"
          desc="Distribution is only available for organizations with stores"
        />
        <div className="rounded-md border border-border bg-muted/30 p-6 text-sm">
          <p style={{ marginBottom: 12 }}>
            Your organization sells directly from organization inventory. Record
            purchases instead of distributing to stores.
          </p>
          <Button asChild>
            <Link href="/purchases">Go to Purchases</Link>
          </Button>
        </div>
      </>
    );
  }

  return <SupplyPageContent />;
}

function SupplyPageContent() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const hasStores = useAppStore((s) => s.user?.hasStores ?? true);
  const defaultRange = useMemo(() => getCurrentMonthRange(), []);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [type, setType] = useState<StockSupplyType | undefined>();
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<StockSupply | null>(
    null,
  );
  const [fixChooser, setFixChooser] = useState<FixChooserState | null>(null);
  const [fixForm, setFixForm] = useState<FixFormState | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      storeId: storeId || undefined,
      categoryId: categoryId || undefined,
      type,
      fromDate,
      toDate,
    }),
    [
      pageIndex,
      pageSize,
      debouncedSearch,
      storeId,
      categoryId,
      type,
      fromDate,
      toDate,
    ],
  );

  const { data: categories = [] } = useCategories();
  const { data: storesData } = useStores({ limit: 100 });
  const { data, isPending, isFetching, isError, error } =
    useStockSupplies(listQuery);

  const createSupply = useCreateStockSupply();
  const correctionAdd = useCreateStockCorrectionAdd();
  const correctionSubtract = useCreateStockCorrectionSubtract();

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading = isPending || (isFetching && (data?.data.length ?? 0) === 0);

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

  const pageInvestment = useMemo(
    () => rows.reduce((sum, row) => sum + supplyInvestment(row), 0),
    [rows],
  );

  const pageUnits = useMemo(
    () => rows.reduce((sum, row) => sum + row.quantity, 0),
    [rows],
  );

  const handleExportAll = useCallback(async () => {
    const limit = 100;
    let page = 1;
    const exported: StockSupply[] = [];
    let totalPages = 1;

    do {
      const response = await listStockSupplies({
        page,
        limit,
        search: debouncedSearch || undefined,
        storeId: storeId || undefined,
        categoryId: categoryId || undefined,
        type,
        fromDate,
        toDate,
      });
      exported.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return exported;
  }, [debouncedSearch, storeId, categoryId, type, fromDate, toDate]);

  const handleCreateSupply = async (input: CreateStockSupplyInput) => {
    try {
      await createSupply.mutateAsync(input);
      addToast({ title: "Stock distributed successfully" });
      setShowCreate(false);
    } catch (e) {
      addErrorToast({
        title: "Failed to create supply",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleFix = async (input: CreateStockCorrectionInput) => {
    if (!fixForm) return;
    const mutation =
      fixForm.mode === "add" ? correctionAdd : correctionSubtract;

    try {
      await mutation.mutateAsync(input);
      addToast({
        title:
          fixForm.mode === "add"
            ? "Missing units added"
            : "Extra units removed",
      });
      setFixForm(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to save fix",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const toolbarExtra = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <DateRangePicker
        fromDate={fromDate}
        toDate={toDate}
        onChange={(range) => {
          setFromDate(range.fromDate);
          setToDate(range.toDate);
          resetPage();
        }}
      />
      {hasStores ? (
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
      ) : null}
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
        value={type}
        onValueChange={(value) => {
          setType(value as StockSupplyType | undefined);
          resetPage();
        }}
        items={[...TYPE_ITEMS]}
        placeholder="All records"
        searchPlaceholder="Search record type…"
        emptyText="No types found."
        clearOption={{ label: "All records" }}
        className="min-w-[160px]"
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Distribute to Store"
        desc="Move stock from the organization warehouse to a store"
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={() => setFixChooser({})}>
              <Wrench className="size-4" />
              Fix a distribution mistake
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="size-4" />
              Distribute
            </Button>
          </div>
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error
            ? error.message
            : "Failed to load stock supplies."}
        </div>
      )}

      {/* <SummaryBar
        items={[
          { k: "Records", v: `${rows.length} on this page` },
          {
            k: "Page Investment",
            v: fmt(pageInvestment),
            color: "var(--brand-indigo)",
          },
          { k: "Net Units", v: `${pageUnits > 0 ? "+" : ""}${pageUnits}` },
        ]}
      /> */}

      <SupplyTable
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
        onView={setSelectedSupply}
        toolbarExtra={toolbarExtra}
      />

      <SupplyModal
        key={showCreate ? "open" : "closed"}
        open={showCreate}
        storeItems={storeItems}
        onClose={() => setShowCreate(false)}
        onSave={(form) => void handleCreateSupply(form)}
        isSaving={createSupply.isPending}
      />

      {selectedSupply && !fixChooser && !fixForm && (
        <SupplyDetailSheet
          supply={selectedSupply}
          onClose={() => setSelectedSupply(null)}
          onFix={(supply) => {
            setSelectedSupply(null);
            setFixChooser({ supply });
          }}
        />
      )}

      <SupplyFixChooserModal
        open={fixChooser !== null}
        supply={fixChooser?.supply}
        onClose={() => setFixChooser(null)}
        onSelect={(mode) => {
          const supply = fixChooser?.supply;
          setFixChooser(null);
          setFixForm({ mode, supply });
        }}
      />

      {fixForm && (
        <SupplyFixModal
          key={`${fixForm.mode}-${fixForm.supply?.id ?? "pick"}`}
          open
          mode={fixForm.mode}
          supply={fixForm.supply}
          storeItems={storeItems}
          hideStoreField={!hasStores}
          onClose={() => setFixForm(null)}
          onSave={(form) => void handleFix(form)}
          isSaving={
            fixForm.mode === "add"
              ? correctionAdd.isPending
              : correctionSubtract.isPending
          }
        />
      )}
    </>
  );
}
