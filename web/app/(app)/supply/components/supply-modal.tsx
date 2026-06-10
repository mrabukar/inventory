"use client";

import { useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useProducts } from "@/hooks/products/use-products";
import { cn } from "@/lib/utils";
import { toNumber } from "@/lib/reports/format";
import type { CreateStockSupplyInput } from "@/types/stock-supplies/stock-supply";

interface SupplyFormValues {
  storeId: string;
  productId: string;
  quantity: string;
  unitPurchasePrice: string;
  note: string;
}

interface SupplyModalProps {
  open: boolean;
  storeItems: { value: string; label: string }[];
  onClose: () => void;
  onSave: (data: CreateStockSupplyInput) => void;
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

export function SupplyModal({
  open,
  storeItems,
  onClose,
  onSave,
  isSaving,
}: SupplyModalProps) {
  const { data: productsData } = useProducts({ limit: 100 });
  const products = useMemo(
    () => productsData?.data ?? [],
    [productsData?.data],
  );

  const productItems = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.name,
      })),
    [products],
  );

  const [form, setForm] = useState<SupplyFormValues>({
    storeId: storeItems[0]?.value ?? "",
    productId: "",
    quantity: "",
    unitPurchasePrice: "",
    note: "",
  });
  const [err, setErr] = useState<Partial<SupplyFormValues>>({});

  const set = (key: keyof SupplyFormValues, value: string) =>
    setForm((state) => ({ ...state, [key]: value }));

  const selectProduct = (productId: string | undefined) => {
    const product = products.find((p) => p.id === productId);
    setForm((state) => ({
      ...state,
      productId: productId ?? "",
      unitPurchasePrice: product
        ? String(toNumber(product.purchasePrice))
        : state.unitPurchasePrice,
    }));
  };

  const save = () => {
    const next: Partial<SupplyFormValues> = {};
    if (!form.storeId) next.storeId = "Store is required";
    if (!form.productId) next.productId = "Product is required";
    if (!form.quantity || +form.quantity <= 0)
      next.quantity = "Enter a positive quantity";
    if (!form.unitPurchasePrice || +form.unitPurchasePrice <= 0)
      next.unitPurchasePrice = "Enter a unit cost";
    setErr(next);
    if (Object.keys(next).length) return;

    onSave({
      storeId: form.storeId,
      productId: form.productId,
      quantity: Number(form.quantity),
      unitPurchasePrice: Number(form.unitPurchasePrice),
      note: form.note.trim() || undefined,
    });
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
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg",
          )}
        >
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              New Supply
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Send stock to a store. Unit cost defaults to the product purchase
              price.
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
            <FormField label="Store" required error={err.storeId}>
              <Combobox
                value={form.storeId || undefined}
                onValueChange={(value) => set("storeId", value ?? "")}
                items={storeItems}
                placeholder="Select store"
                searchPlaceholder="Search stores…"
                emptyText="No stores found."
                className="w-full"
                popoverClassName="z-[200]"
              />
            </FormField>

            <FormField label="Product" required error={err.productId}>
              <Combobox
                value={form.productId || undefined}
                onValueChange={selectProduct}
                items={productItems}
                placeholder="Select product"
                searchPlaceholder="Search products…"
                emptyText="No products found."
                className="w-full"
                popoverClassName="z-[200]"
              />
            </FormField>

            <FormField label="Quantity" required error={err.quantity}>
              <input
                className={cn(inputClassName, err.quantity && "border-destructive")}
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                placeholder="e.g. 50"
              />
            </FormField>

            <FormField
              label="Unit cost"
              required
              error={err.unitPurchasePrice}
              helper="Override if this batch cost differs from the catalog price."
            >
              <input
                className={cn(
                  inputClassName,
                  err.unitPurchasePrice && "border-destructive",
                )}
                type="number"
                value={form.unitPurchasePrice}
                onChange={(e) => set("unitPurchasePrice", e.target.value)}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Note">
              <textarea
                className={cn(
                  inputClassName,
                  "min-h-[80px] resize-y py-2",
                )}
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Optional note about this supply"
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
              {isSaving ? "Saving…" : "Save Supply"}
            </Button>
          </div>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
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
