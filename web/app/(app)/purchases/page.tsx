"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  PurchaseFixChooserModal,
  type PurchaseFixMode,
} from "./components/purchase-fix-chooser-modal";
import { PurchaseChangeProductModal } from "./components/purchase-change-product-modal";
import { PurchaseFixModal } from "./components/purchase-fix-modal";
import { PurchaseTable } from "./components/purchase-table";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/categories/use-categories";
import {
  useChangePurchaseProduct,
  useCorrectPurchaseAdd,
  useCorrectPurchaseSubtract,
} from "@/hooks/purchases/use-correct-purchase";
import { usePurchases } from "@/hooks/purchases/use-purchases";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getCurrentMonthRange } from "@/lib/filters/dates";
import { useAppStore } from "@/store/app";
import type {
  ChangePurchaseProductInput,
  CorrectPurchaseInput,
  Purchase,
} from "@/types/purchases/purchase";

interface FixChooserState {
  purchase: Purchase;
}

interface FixFormState {
  mode: PurchaseFixMode;
  purchase: Purchase;
}

export default function PurchasesPage() {
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const defaultRange = useMemo(() => getCurrentMonthRange(), []);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [fixChooser, setFixChooser] = useState<FixChooserState | null>(null);
  const [fixForm, setFixForm] = useState<FixFormState | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedInvoice = useDebouncedValue(invoiceNumber, 300);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      categoryId: categoryId || undefined,
      invoiceNumber: debouncedInvoice || undefined,
      fromDate,
      toDate,
    }),
    [
      pageIndex,
      pageSize,
      debouncedSearch,
      categoryId,
      debouncedInvoice,
      fromDate,
      toDate,
    ],
  );

  const { data: categories = [] } = useCategories();
  const { data, isPending, isFetching, isError, error } =
    usePurchases(listQuery);
  const correctionAdd = useCorrectPurchaseAdd();
  const correctionSubtract = useCorrectPurchaseSubtract();
  const changeProduct = useChangePurchaseProduct();

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

  const resetPage = () => setPageIndex(0);

  const handleFix = async (input: CorrectPurchaseInput) => {
    if (!fixForm || fixForm.mode === "change-product") return;
    const mutation =
      fixForm.mode === "add" ? correctionAdd : correctionSubtract;

    try {
      await mutation.mutateAsync({
        purchaseId: fixForm.purchase.id,
        input,
      });
      addToast({
        title:
          fixForm.mode === "add"
            ? "Missing units added"
            : "Extra units removed",
      });
      setFixForm(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to correct purchase",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleChangeProduct = async (
    input: ChangePurchaseProductInput,
    targetLabel: string,
  ) => {
    if (!fixForm) return;

    try {
      await changeProduct.mutateAsync({
        purchaseId: fixForm.purchase.id,
        input,
      });
      addToast({
        title: `Moved ${input.quantity} unit${input.quantity === 1 ? "" : "s"} to ${targetLabel}`,
      });
      setFixForm(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to change the product",
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
      <input
        className="f-input"
        style={{ minWidth: 160 }}
        value={invoiceNumber}
        onChange={(e) => {
          setInvoiceNumber(e.target.value);
          resetPage();
        }}
        placeholder="Invoice number"
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
    </div>
  );

  return (
    <>
      <PageHeader
        title="Purchases"
        desc="Record vendor purchases and track purchase history"
        action={
          <Button onClick={() => router.push("/purchases/new")}>
            <Plus className="size-4" />
            Record Purchase
          </Button>
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error
            ? error.message
            : "Failed to load purchases."}
        </div>
      )}

      <PurchaseTable
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
        toolbarExtra={toolbarExtra}
        onCorrect={(purchase) => setFixChooser({ purchase })}
      />

      <PurchaseFixChooserModal
        open={fixChooser !== null}
        purchase={fixChooser?.purchase}
        onClose={() => setFixChooser(null)}
        onSelect={(mode) => {
          if (!fixChooser) return;
          setFixForm({ mode, purchase: fixChooser.purchase });
          setFixChooser(null);
        }}
      />

      {fixForm?.mode === "change-product" ? (
        <PurchaseChangeProductModal
          key={`${fixForm.purchase.id}-change-product`}
          open
          purchase={fixForm.purchase}
          onClose={() => setFixForm(null)}
          onSave={(form, targetLabel) =>
            void handleChangeProduct(form, targetLabel)
          }
          isSaving={changeProduct.isPending}
        />
      ) : (
        <PurchaseFixModal
          key={
            fixForm
              ? `${fixForm.purchase.id}-${fixForm.mode}`
              : "purchase-fix-closed"
          }
          open={fixForm !== null}
          mode={fixForm?.mode ?? "add"}
          purchase={fixForm?.purchase ?? null}
          onClose={() => setFixForm(null)}
          onSave={(form) => void handleFix(form)}
          isSaving={correctionAdd.isPending || correctionSubtract.isPending}
        />
      )}
    </>
  );
}
