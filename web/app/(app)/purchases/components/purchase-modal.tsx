"use client";

import { useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProducts } from "@/hooks/products/use-products";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { cn } from "@/lib/utils";
import { formatProductLabel } from "@/lib/products/format";
import { formatPriceInput, toNumber } from "@/lib/reports/format";
import { productUnitCost } from "@/lib/products/unit-cost";
import { todayYmd } from "@/lib/filters/dates";
import {
  computeWeightedAverageCost,
  grossMarginPercent,
} from "@/lib/purchases/weighted-average";
import type { CreatePurchaseInput } from "@/types/purchases/purchase";

interface PurchaseFormValues {
  productId: string;
  quantity: string;
  unitPurchasePrice: string;
  purchaseDate: string;
  invoiceNumber: string;
  note: string;
  newSellingPrice: string;
  updateSellingPrice: boolean;
}

interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreatePurchaseInput) => void;
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

export function PurchaseModal({
  open,
  onClose,
  onSave,
  isSaving,
}: PurchaseModalProps) {
  const { data: productsData } = useProducts({ limit: 100 });
  const products = useMemo(
    () => productsData?.data ?? [],
    [productsData?.data],
  );

  const productItems = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: formatProductLabel(product.name, product.model),
      })),
    [products],
  );

  const [form, setForm] = useState<PurchaseFormValues>({
    productId: "",
    quantity: "",
    unitPurchasePrice: "",
    purchaseDate: todayYmd(),
    invoiceNumber: "",
    note: "",
    newSellingPrice: "",
    updateSellingPrice: false,
  });
  const [err, setErr] = useState<Partial<PurchaseFormValues>>({});
  const [lossConfirm, setLossConfirm] = useState<{
    message: string;
    payload: CreatePurchaseInput;
  } | null>(null);

  const selectedProduct = products.find((p) => p.id === form.productId);

  const { data: inventoryData } = useInventory(
    { productId: form.productId || undefined, limit: 100 },
    "all",
  );

  const onHand = useMemo(
    () =>
      (inventoryData?.data ?? []).reduce(
        (sum, row) => sum + row.quantity,
        0,
      ),
    [inventoryData?.data],
  );

  const preview = useMemo(() => {
    if (!selectedProduct || !form.quantity || !form.unitPurchasePrice) {
      return null;
    }

    const qty = Number(form.quantity);
    const unitCost = Number(form.unitPurchasePrice);
    if (qty <= 0 || unitCost <= 0) return null;

    const currentAverage = toNumber(selectedProduct.averageCost);
    const newAverage = computeWeightedAverageCost(
      onHand,
      currentAverage,
      qty,
      unitCost,
    );
    const sellingPrice = form.updateSellingPrice
      ? Number(form.newSellingPrice) || 0
      : toNumber(selectedProduct.sellingPrice);
    const margin = grossMarginPercent(sellingPrice, newAverage);

    return { newAverage, sellingPrice, margin };
  }, [selectedProduct, form, onHand]);

  const unitCost = Number(form.unitPurchasePrice) || 0;
  const currentSellingPrice = selectedProduct
    ? toNumber(selectedProduct.sellingPrice)
    : 0;
  const effectiveSellingPrice = form.updateSellingPrice
    ? Number(form.newSellingPrice) || 0
    : currentSellingPrice;
  const isLossAtUnitCost =
    unitCost > 0 &&
    effectiveSellingPrice > 0 &&
    unitCost > effectiveSellingPrice;
  const showMarginWarning =
    Boolean(preview && preview.margin < 0) || isLossAtUnitCost;

  const set = (key: keyof PurchaseFormValues, value: string | boolean) =>
    setForm((state) => ({ ...state, [key]: value }));

  const setUnitPurchasePrice = (value: string) => {
    setForm((state) => {
      const next = { ...state, unitPurchasePrice: value };
      const cost = Number(value);
      const product = products.find((p) => p.id === state.productId);

      if (product && cost > 0 && cost > toNumber(product.sellingPrice)) {
        next.updateSellingPrice = true;
        next.newSellingPrice = formatPriceInput(
          Math.max(toNumber(product.sellingPrice), cost),
        );
      }

      return next;
    });
  };

  const selectProduct = (productId: string | undefined) => {
    const product = products.find((p) => p.id === productId);
    const costHint =
      product && productUnitCost(product) > 0
        ? formatPriceInput(productUnitCost(product))
        : "";
    const hintCost = costHint ? Number(costHint) : 0;
    const currentSelling = product ? toNumber(product.sellingPrice) : 0;
    const autoUpdatePrice = Boolean(product && hintCost > currentSelling);

    setForm((state) => ({
      ...state,
      productId: productId ?? "",
      unitPurchasePrice: costHint,
      updateSellingPrice: autoUpdatePrice,
      newSellingPrice: product
        ? formatPriceInput(
            autoUpdatePrice ? Math.max(currentSelling, hintCost) : currentSelling,
          )
        : state.newSellingPrice,
    }));
  };

  const buildPayload = (): CreatePurchaseInput | null => {
    const next: Partial<PurchaseFormValues> = {};
    if (!form.productId) next.productId = "Product is required";
    if (!form.quantity || +form.quantity <= 0)
      next.quantity = "Enter a positive quantity";
    if (!form.unitPurchasePrice || +form.unitPurchasePrice <= 0)
      next.unitPurchasePrice = "Enter a unit cost";
    if (!form.purchaseDate) next.purchaseDate = "Purchase date is required";
    if (form.updateSellingPrice) {
      if (!form.newSellingPrice || +form.newSellingPrice <= 0)
        next.newSellingPrice = "Enter a selling price";
    }
    setErr(next);
    if (Object.keys(next).length) return null;

    return {
      productId: form.productId,
      quantity: Number(form.quantity),
      unitPurchasePrice: Number(form.unitPurchasePrice),
      purchaseDate: form.purchaseDate,
      invoiceNumber: form.invoiceNumber.trim() || undefined,
      note: form.note.trim() || undefined,
      ...(form.updateSellingPrice
        ? { newSellingPrice: Number(form.newSellingPrice) }
        : undefined),
    };
  };

  const submitPayload = (payload: CreatePurchaseInput) => {
    onSave(payload);
    setLossConfirm(null);
  };

  const save = () => {
    const payload = buildPayload();
    if (!payload || !selectedProduct) return;

    const cost = payload.unitPurchasePrice;
    const effectiveSelling = form.updateSellingPrice
      ? payload.newSellingPrice ?? 0
      : currentSellingPrice;

    if (cost <= effectiveSelling) {
      submitPayload(payload);
      return;
    }

    const needsPriceOverride =
      form.updateSellingPrice && payload.newSellingPrice !== undefined;

    setLossConfirm({
      message: needsPriceOverride
        ? `New selling price (${payload.newSellingPrice!.toFixed(2)}) is below unit cost (${cost.toFixed(2)}). The purchase will still be recorded.`
        : `Unit cost (${cost.toFixed(2)}) exceeds the current selling price (${currentSellingPrice.toFixed(2)}). Stock and average cost will update, but the selling price stays the same until you change it.`,
      payload: needsPriceOverride
        ? { ...payload, acceptSellingBelowCost: true }
        : payload,
    });
  };

  const confirmLossSave = () => {
    if (lossConfirm) submitPayload(lossConfirm.payload);
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
              Record Purchase
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Stock is added to the organization warehouse. Average cost
              updates automatically.
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
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
                placeholder="e.g. 10"
              />
            </FormField>

            <FormField
              label="Unit purchase price"
              required
              error={err.unitPurchasePrice}
              helper="Enter what you paid the vendor for this buy."
            >
              <input
                className={cn(
                  inputClassName,
                  err.unitPurchasePrice && "border-destructive",
                )}
                type="number"
                min={0}
                step="0.01"
                value={form.unitPurchasePrice}
                onChange={(e) => setUnitPurchasePrice(e.target.value)}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Purchase date" required error={err.purchaseDate}>
              <input
                className={cn(
                  inputClassName,
                  err.purchaseDate && "border-destructive",
                )}
                type="date"
                value={form.purchaseDate}
                onChange={(e) => set("purchaseDate", e.target.value)}
              />
            </FormField>

            <FormField label="Invoice number">
              <input
                className={inputClassName}
                value={form.invoiceNumber}
                onChange={(e) => set("invoiceNumber", e.target.value)}
                placeholder="Optional supplier invoice reference"
              />
            </FormField>

            <FormField label="Note">
              <textarea
                className={cn(inputClassName, "min-h-[80px] resize-y py-2")}
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Optional note"
              />
            </FormField>

            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.updateSellingPrice}
                  onChange={(e) => set("updateSellingPrice", e.target.checked)}
                />
                Update selling price
              </label>
              {form.updateSellingPrice ? (
                <FormField
                  label="New selling price"
                  error={err.newSellingPrice}
                  helper={
                    unitCost > 0
                      ? `Must be at least ${unitCost.toFixed(2)} to avoid a loss, or confirm when saving.`
                      : undefined
                  }
                >
                  <input
                    className={cn(
                      inputClassName,
                      err.newSellingPrice && "border-destructive",
                    )}
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.newSellingPrice}
                    onChange={(e) => set("newSellingPrice", e.target.value)}
                    placeholder="0.00"
                  />
                </FormField>
              ) : null}
            </div>

            {preview ? (
              <div
                className={cn(
                  "rounded-md border p-3 text-sm",
                  showMarginWarning
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border bg-muted/40",
                )}
              >
                {showMarginWarning ? (
                  <p className="mb-2 flex items-start gap-2 font-medium">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {isLossAtUnitCost
                      ? "Unit cost exceeds selling price — you would sell at a loss."
                      : "Projected margin is negative at this average cost."}
                  </p>
                ) : null}
                <p>
                  New average cost:{" "}
                  <strong>{preview.newAverage.toFixed(2)}</strong>
                </p>
                <p>
                  At selling price {preview.sellingPrice.toFixed(2)} → margin{" "}
                  <strong>{preview.margin.toFixed(1)}%</strong>
                </p>
              </div>
            ) : null}
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
              {isSaving ? "Saving…" : "Save Purchase"}
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

      {lossConfirm ? (
        <ConfirmDialog
          title="Selling at a loss?"
          message={lossConfirm.message}
          confirmLabel="Save anyway — selling at a loss"
          variant="danger"
          isLoading={isSaving}
          onConfirm={confirmLossSave}
          onClose={() => setLossConfirm(null)}
        />
      ) : null}
    </Dialog.Root>
  );
}
