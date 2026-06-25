"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { listStockSupplies } from "@/service/stock-supplies/list-stock-supplies";
import { listInventory } from "@/service/inventory/list-inventory";
import { stockSuppliesQueryKey } from "@/hooks/stock-supplies/use-stock-supplies";
import { cn } from "@/lib/utils";
import {
  formatSupplyFixContextLabel,
  formatSupplyFixProductLabel,
  type CreateStockCorrectionInput,
  type StockSupply,
} from "@/types/stock-supplies/stock-supply";
import type { SupplyFixMode } from "./supply-fix-chooser-modal";
import type { Inventory } from "@/types/inventory/inventory";

interface SupplyFixModalProps {
  open: boolean;
  mode: SupplyFixMode;
  supply?: StockSupply;
  storeItems: { value: string; label: string }[];
  hideStoreField?: boolean;
  onClose: () => void;
  onSave: (data: CreateStockCorrectionInput) => void;
  isSaving: boolean;
}

function FormField({
  label,
  required,
  error,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium leading-none">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {helper && !error ? (
        <p className="text-sm text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
  "sm:rounded-lg",
);

const COPY = {
  add: {
    title: "Add missing units",
    description:
      "Record units that were supplied but not counted in the original entry.",
    quantityLabel: "How many units were missing?",
    quantityPlaceholder: "e.g. 5",
    submit: "Add missing units",
  },
  subtract: {
    title: "Remove extra units",
    description:
      "Remove units that were recorded by mistake and should not count toward stock.",
    quantityLabel: "How many extra units should be removed?",
    quantityPlaceholder: "e.g. 3",
    submit: "Remove extra units",
  },
} as const;

async function fetchStoreInventoryRows(
  storeId?: string,
  productId?: string,
): Promise<Inventory[]> {
  if (productId) {
    const response = await listInventory(
      {
        ...(storeId ? { storeId } : {}),
        productId,
        limit: 1,
      },
      "all",
    );
    return response.data;
  }

  const rows: Inventory[] = [];
  let page = 1;
  let totalPages = 1;
  const base = { ...(storeId ? { storeId } : {}), limit: 100 };

  do {
    const response = await listInventory({ ...base, page }, "all");
    rows.push(...response.data);
    totalPages = response.meta.totalPages;
    page += 1;
  } while (page <= totalPages);

  return rows;
}

export function SupplyFixModal({
  open,
  mode,
  supply: initialSupply,
  storeItems,
  hideStoreField = false,
  onClose,
  onSave,
  isSaving,
}: SupplyFixModalProps) {
  const copy = COPY[mode];
  const fromDetail = Boolean(initialSupply);

  const [storeId, setStoreId] = useState(initialSupply?.storeId ?? "");
  const [productId, setProductId] = useState(initialSupply?.productId ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<{
    storeId?: string;
    productId?: string;
    quantity?: string;
    note?: string;
  }>({});

  const effectiveStoreId =
    initialSupply?.storeId ?? (hideStoreField ? undefined : storeId || undefined);

  const { data: inventoryRows = [], isFetching: isLoadingStock } = useQuery({
    queryKey: [
      "supply-fix-stock",
      effectiveStoreId ?? "org-wide",
      fromDetail ? initialSupply?.productId : "picker",
    ] as const,
    queryFn: () =>
      fetchStoreInventoryRows(
        effectiveStoreId,
        fromDetail ? initialSupply?.productId : undefined,
      ),
    enabled: open && (Boolean(effectiveStoreId) || hideStoreField),
  });

  const stockByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of inventoryRows) {
      map.set(row.productId, row.quantity);
    }
    return map;
  }, [inventoryRows]);

  const { data: storeSuppliesData, isFetching: isLoadingProducts } = useQuery({
    queryKey: stockSuppliesQueryKey({ page: 1, limit: 100, storeId }),
    queryFn: () =>
      listStockSupplies({ page: 1, limit: 100, storeId: storeId || undefined }),
    enabled:
      open && !fromDetail && (hideStoreField || Boolean(storeId)),
  });

  const storeSupplies = useMemo(
    () => storeSuppliesData?.data ?? [],
    [storeSuppliesData?.data],
  );

  const productItems = useMemo(() => {
    const byProduct = new Map<
      string,
      { value: string; label: string; supplyId: string; keywords: string[] }
    >();

    for (const row of storeSupplies) {
      if (byProduct.has(row.productId)) continue;
      byProduct.set(row.productId, {
        value: row.productId,
        label: formatSupplyFixProductLabel(
          row,
          stockByProductId.get(row.productId) ?? 0,
        ),
        supplyId: row.id,
        keywords: [row.product.name, row.product.model ?? "", row.createdAt.slice(0, 10)],
      });
    }

    return Array.from(byProduct.values());
  }, [storeSupplies, stockByProductId]);

  const selectedProductMeta = useMemo(
    () => productItems.find((item) => item.value === productId),
    [productItems, productId],
  );

  const save = () => {
    const next: typeof err = {};

    if (fromDetail && initialSupply) {
      if (!quantity || +quantity <= 0)
        next.quantity = "Enter how many units to adjust";
      if (!note.trim()) next.note = "Please explain why you are making this fix";
      setErr(next);
      if (Object.keys(next).length) return;

      onSave({
        productId: initialSupply.productId,
        ...(hideStoreField ? {} : { storeId: initialSupply.storeId }),
        quantity: Number(quantity),
        note: note.trim(),
        correctsSupplyId: initialSupply.id,
      });
      return;
    }

    if (!hideStoreField && !storeId) next.storeId = "Select a store";
    if (!productId) next.productId = "Select a product";
    if (!quantity || +quantity <= 0)
      next.quantity = "Enter how many units to adjust";
    if (!note.trim()) next.note = "Please explain why you are making this fix";
    setErr(next);
    if (Object.keys(next).length) return;

    onSave({
      productId,
      ...(hideStoreField ? {} : { storeId }),
      quantity: Number(quantity),
      note: note.trim(),
      correctsSupplyId: selectedProductMeta?.supplyId,
    });
  };

  const handleStoreChange = (value: string | undefined) => {
    setStoreId(value ?? "");
    setProductId("");
    setErr((prev) => ({ ...prev, storeId: undefined, productId: undefined }));
  };

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
              {copy.title}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {copy.description}
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
            {fromDetail && initialSupply ? (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-medium">Fixing: </span>
                <span className="text-muted-foreground">
                  {formatSupplyFixContextLabel(
                    initialSupply,
                    stockByProductId.get(initialSupply.productId) ?? 0,
                  )}
                </span>
              </div>
            ) : (
              <>
                {!hideStoreField ? (
                  <FormField label="Store" required error={err.storeId}>
                    <Combobox
                      value={storeId || undefined}
                      onValueChange={handleStoreChange}
                      items={storeItems}
                      placeholder="Select store"
                      searchPlaceholder="Search stores…"
                      emptyText="No stores found."
                      className="w-full"
                      popoverClassName="z-[200]"
                    />
                  </FormField>
                ) : null}

                <FormField label="Product" required error={err.productId}>
                  <Combobox
                    value={productId || undefined}
                    onValueChange={(value) => {
                      setProductId(value ?? "");
                      setErr((prev) => ({ ...prev, productId: undefined }));
                    }}
                    items={productItems}
                    placeholder={
                      !hideStoreField && !storeId
                        ? "Select a store first"
                        : isLoadingProducts
                          ? "Loading products…"
                          : "Select product"
                    }
                    searchPlaceholder="Search products…"
                    emptyText={
                      hideStoreField || storeId
                        ? "No supplied products found."
                        : "Select a store first."
                    }
                    disabled={
                      (!hideStoreField && !storeId) ||
                      isLoadingProducts ||
                      isLoadingStock
                    }
                    className="w-full"
                    popoverClassName="z-[200]"
                  />
                </FormField>
              </>
            )}

            <FormField
              label={copy.quantityLabel}
              required
              error={err.quantity}
              helper="Always enter a positive number."
            >
              <input
                className={cn(inputClassName, err.quantity && "border-destructive")}
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={copy.quantityPlaceholder}
              />
            </FormField>

            <FormField
              label="Why are you making this fix?"
              required
              error={err.note}
            >
              <textarea
                className={cn(
                  inputClassName,
                  "min-h-[80px] resize-y py-2",
                  err.note && "border-destructive",
                )}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Counted 50 boxes but only 45 were on the delivery note"
              />
            </FormField>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving ? "Saving…" : copy.submit}
            </Button>
          </div>

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
