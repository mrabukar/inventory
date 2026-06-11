"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { ProductDistributionContent } from "./product-distribution-content";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCategories } from "@/hooks/categories/use-categories";
import { useStores } from "@/hooks/stores/list-stores";
import {
  formatPeriodLabel,
  getCurrentMonthRange,
} from "@/lib/filters/dates";
import { cn } from "@/lib/utils";
import type { ProductDistributionQuery } from "@/types/reports/product-distribution";

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "sm:rounded-lg",
);

interface Props {
  open: boolean;
  onClose: () => void;
  initialCategoryId?: number;
  initialStoreId?: string;
}

export function ProductDistributionModal({
  open,
  onClose,
  initialCategoryId,
  initialStoreId,
}: Props) {
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: storesData, isLoading: storesLoading } = useStores({ limit: 100 });
  const stores = storesData?.data ?? [];

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [storeId, setStoreId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    const monthRange = getCurrentMonthRange();
    setFromDate(monthRange.fromDate);
    setToDate(monthRange.toDate);
    setCategoryId(initialCategoryId);
    setStoreId(initialStoreId);
  }, [open, initialCategoryId, initialStoreId]);

  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
        keywords: [category.name],
      })),
    [categories],
  );

  const storeItems = useMemo(
    () =>
      stores.map((store) => ({
        value: store.id,
        label: store.name,
        keywords: [store.name, store.address],
      })),
    [stores],
  );

  const distributionQuery = useMemo((): ProductDistributionQuery | null => {
    if (categoryId == null || !fromDate || !toDate) return null;
    return {
      fromDate,
      toDate,
      storeId,
      categoryId,
    };
  }, [fromDate, toDate, storeId, categoryId]);

  const periodLabel =
    fromDate && toDate ? formatPeriodLabel(fromDate, toDate) : "";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className={dialogContentClassName}>
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Custom product distribution
            </Dialog.Title>
            {periodLabel ? (
              <Dialog.Description className="text-sm text-muted-foreground">
                {periodLabel}
              </Dialog.Description>
            ) : null}
          </div>

          <div
            className="dash-chart-toolbar"
            style={{ justifyContent: "flex-start", marginBottom: 0 }}
          >
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onChange={(range) => {
                setFromDate(range.fromDate);
                setToDate(range.toDate);
              }}
            />
            <Combobox
              value={categoryId != null ? String(categoryId) : undefined}
              onValueChange={(value) => {
                setCategoryId(value ? Number(value) : undefined);
              }}
              items={categoryItems}
              placeholder="Category"
              searchPlaceholder="Search categories…"
              emptyText="No categories found."
              loading={categoriesLoading}
              className="min-w-[160px]"
              popoverClassName="z-[200]"
            />
            <Combobox
              value={storeId}
              onValueChange={setStoreId}
              items={storeItems}
              placeholder="All stores"
              searchPlaceholder="Search stores…"
              emptyText="No stores found."
              clearOption={{ label: "All stores" }}
              loading={storesLoading}
              className="min-w-[160px]"
              popoverClassName="z-[200]"
            />
          </div>

          <ProductDistributionContent
            query={distributionQuery}
            chartHeight={360}
          />

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={onClose}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
