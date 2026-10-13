"use client";

import { useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { useWarehouseInventory } from "@/hooks/inventory/use-warehouse-inventory";
import { useProducts } from "@/hooks/products/use-products";
import { cn, fmt } from "@/lib/utils";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import {
  computeWeightedAverageCost,
  reverseWeightedAverageCost,
} from "@/lib/purchases/weighted-average";
import { purchaseReversibleQuantity } from "@/lib/purchases/reversible-quantity";
import type {
  ChangePurchaseProductInput,
  Purchase,
} from "@/types/purchases/purchase";

interface PurchaseChangeProductModalProps {
  open: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onSave: (data: ChangePurchaseProductInput, targetLabel: string) => void;
  isSaving: boolean;
}

interface FieldErrors {
  productId?: string;
  quantity?: string;
  unitPrice?: string;
  reason?: string;
}

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function sumQuantity(rows: { quantity: number }[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + row.quantity, 0);
}

function plural(count: number): string {
  return count === 1 ? "" : "s";
}

export function PurchaseChangeProductModal({
  open,
  purchase,
  onClose,
  onSave,
  isSaving,
}: PurchaseChangeProductModalProps) {
  const maxMovable = purchase ? purchaseReversibleQuantity(purchase) : 0;
  const originalUnitPrice = purchase ? toNumber(purchase.unitPurchasePrice) : 0;

  const [productId, setProductId] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(
    maxMovable > 0 ? String(maxMovable) : "",
  );
  const [unitPrice, setUnitPrice] = useState(
    purchase ? originalUnitPrice.toFixed(2) : "",
  );
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<FieldErrors>({});

  const { data: productsData, isPending: productsLoading } = useProducts({
    limit: 100,
  }); // ! limit must not be greater than 100

  const { data: wrongWarehouseData } = useWarehouseInventory({
    productId: purchase?.productId || undefined,
    limit: 100,
  });
  const { data: wrongInventoryData } = useInventory(
    { productId: purchase?.productId || undefined, limit: 100 },
    "all",
  );
  const targetInventory = useInventory(
    { productId: productId || undefined, limit: 100 },
    "all",
  );

  const warehouseQty = wrongWarehouseData
    ? sumQuantity(
        wrongWarehouseData.data.filter(
          (row) => row.productId === purchase?.productId,
        ),
      )
    : null;
  const wrongOnHand = sumQuantity(wrongInventoryData?.data);
  const targetOnHand =
    productId && targetInventory.isSuccess
      ? sumQuantity(targetInventory.data.data)
      : null;

  const productItems = useMemo(
    () =>
      (productsData?.data ?? [])
        .filter((p) => p.isActive !== false && p.id !== purchase?.productId)
        .map((p) => ({
          value: p.id,
          label: formatProductLabel(p.name, p.model),
          keywords: [p.name, p.model ?? "", p.category?.name ?? ""],
        })),
    [productsData?.data, purchase?.productId],
  );

  const targetProduct = useMemo(
    () => (productsData?.data ?? []).find((p) => p.id === productId),
    [productsData?.data, productId],
  );

  const qty = Number(quantity);
  const price = Number(unitPrice);
  const qtyValid = quantity !== "" && Number.isInteger(qty) && qty > 0;
  const priceValid = /^\d+(\.\d{1,2})?$/.test(unitPrice.trim()) && price > 0;

  const quantityError = (() => {
    if (quantity === "") return undefined;
    if (!qtyValid) return "Enter a whole number of units above zero";
    if (qty > maxMovable) {
      return `Only ${maxMovable} unit${plural(maxMovable)} left on this purchase`;
    }
    if (warehouseQty !== null && qty > warehouseQty) {
      return `Only ${warehouseQty} unit${plural(warehouseQty)} still in the warehouse. Units already distributed or sold must be returned first.`;
    }
    return undefined;
  })();

  const unitPriceError =
    unitPrice !== "" && !priceValid
      ? "Enter a price above zero with at most 2 decimals"
      : undefined;

  const preview = useMemo(() => {
    if (!purchase || !targetProduct || targetOnHand === null) return null;
    if (!qtyValid || !priceValid || quantityError) return null;

    const wrongAverage = toNumber(purchase.product.averageCost);
    const targetAverage = toNumber(targetProduct.averageCost);
    const targetNewAverage = computeWeightedAverageCost(
      targetOnHand,
      targetAverage,
      qty,
      price,
    );
    const targetSelling = toNumber(targetProduct.sellingPrice);

    return {
      wrongAverage,
      wrongNewAverage: reverseWeightedAverageCost(
        wrongOnHand,
        wrongAverage,
        qty,
        originalUnitPrice,
      ),
      targetAverage,
      targetNewAverage,
      targetSelling,
      investmentChange: Math.round(qty * (price - originalUnitPrice) * 100) / 100,
      sellsAtLoss: price > targetSelling,
      negativeMargin: targetNewAverage > targetSelling,
    };
  }, [
    purchase,
    targetProduct,
    targetOnHand,
    qtyValid,
    priceValid,
    quantityError,
    qty,
    price,
    wrongOnHand,
    originalUnitPrice,
  ]);

  const save = () => {
    if (!purchase) return;

    const next: FieldErrors = {};
    if (!productId || !targetProduct) {
      next.productId = "Choose the product these units really are";
    }
    if (!qtyValid) {
      next.quantity = "Enter a whole number of units above zero";
    } else if (quantityError) {
      next.quantity = quantityError;
    }
    if (!priceValid) {
      next.unitPrice = "Enter a price above zero with at most 2 decimals";
    }
    if (!reason.trim()) {
      next.reason = "Please explain why the product is being changed";
    }

    setErr(next);
    if (Object.keys(next).length || !productId || !targetProduct) return;

    onSave(
      {
        productId,
        quantity: qty,
        unitPurchasePrice: price,
        reason: reason.trim(),
      },
      formatProductLabel(targetProduct.name, targetProduct.model),
    );
  };

  const canSave =
    purchase != null &&
    !!productId &&
    qtyValid &&
    !quantityError &&
    priceValid &&
    reason.trim().length > 0 &&
    !isSaving;

  const wrongLabel = purchase
    ? formatProductLabel(purchase.product.name, purchase.product.model)
    : "";
  const targetLabel = targetProduct
    ? formatProductLabel(targetProduct.name, targetProduct.model)
    : "";

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
            "fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto border border-border bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg",
          )}
        >
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Move to the correct product
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Takes the units off the wrong product and records them on the
              correct one, with the same date and invoice.
            </Dialog.Description>
          </div>

          {purchase ? (
            <div className="grid gap-4 py-2">
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-medium">Recorded as: </span>
                <span>{wrongLabel}</span>
                <div className="mt-1 text-muted-foreground">
                  {purchase.quantity} unit{plural(purchase.quantity)} @{" "}
                  {fmt(originalUnitPrice)}
                  {purchase.invoiceNumber ? ` · ${purchase.invoiceNumber}` : ""}
                  {maxMovable < purchase.quantity
                    ? ` · ${maxMovable} left after earlier fixes`
                    : ""}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium leading-none">
                  Correct product
                  <span className="text-destructive"> *</span>
                </label>
                <Combobox
                  value={productId}
                  onValueChange={(value) => {
                    setProductId(value);
                    if (err.productId) {
                      setErr((prev) => ({ ...prev, productId: undefined }));
                    }
                  }}
                  items={productItems}
                  loading={productsLoading}
                  placeholder="Select a product…"
                  searchPlaceholder="Search products…"
                  emptyText="No products found."
                  className={cn(
                    "h-10 w-full",
                    err.productId && "border-destructive",
                  )}
                  popoverClassName="z-[200]"
                />
                {err.productId ? (
                  <p className="text-sm text-destructive">{err.productId}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid content-start gap-2">
                  <label className="text-sm font-medium leading-none">
                    Units to move
                    <span className="text-destructive"> *</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      className={cn(
                        inputClassName,
                        (err.quantity || quantityError) && "border-destructive",
                      )}
                      type="number"
                      min={1}
                      max={maxMovable > 0 ? maxMovable : undefined}
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(e.target.value);
                        if (err.quantity) {
                          setErr((prev) => ({ ...prev, quantity: undefined }));
                        }
                      }}
                    />
                    {maxMovable > 0 && qty !== maxMovable ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={() => setQuantity(String(maxMovable))}
                      >
                        All
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid content-start gap-2">
                  <label className="text-sm font-medium leading-none">
                    Unit price
                    <span className="text-destructive"> *</span>
                  </label>
                  <input
                    className={cn(
                      inputClassName,
                      (err.unitPrice || unitPriceError) && "border-destructive",
                    )}
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => {
                      setUnitPrice(e.target.value);
                      if (err.unitPrice) {
                        setErr((prev) => ({ ...prev, unitPrice: undefined }));
                      }
                    }}
                  />
                </div>
              </div>
              {err.quantity || quantityError ? (
                <p className="-mt-2 text-sm text-destructive">
                  {err.quantity ?? quantityError}
                </p>
              ) : null}
              {err.unitPrice || unitPriceError ? (
                <p className="-mt-2 text-sm text-destructive">
                  {err.unitPrice ?? unitPriceError}
                </p>
              ) : (
                <p className="-mt-2 text-sm text-muted-foreground">
                  Prefilled with the original price. Change it if the correct
                  product cost something different on the invoice.
                </p>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-medium leading-none">
                  Reason
                  <span className="text-destructive"> *</span>
                </label>
                <textarea
                  className={cn(
                    inputClassName,
                    "min-h-[80px] resize-y py-2",
                    err.reason && "border-destructive",
                  )}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Recorded as Test by mistake — the invoice says Product X"
                />
                {err.reason ? (
                  <p className="text-sm text-destructive">{err.reason}</p>
                ) : null}
              </div>

              {preview ? (
                <div className="grid gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                  {preview.sellsAtLoss || preview.negativeMargin ? (
                    <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      {preview.sellsAtLoss
                        ? `${targetLabel} sells for ${fmt(preview.targetSelling)}, below this unit price — selling at a loss.`
                        : `${targetLabel}'s new average cost is above its selling price of ${fmt(preview.targetSelling)}.`}
                    </p>
                  ) : null}
                  <p>
                    <span className="font-medium">{wrongLabel}:</span>{" "}
                    warehouse {warehouseQty ?? "…"} →{" "}
                    <strong>{warehouseQty !== null ? warehouseQty - qty : "…"}</strong>
                    , average cost {preview.wrongAverage.toFixed(2)} →{" "}
                    <strong>{preview.wrongNewAverage.toFixed(2)}</strong>
                  </p>
                  <p>
                    <span className="font-medium">{targetLabel}:</span>{" "}
                    +{qty} unit{plural(qty)}, average cost{" "}
                    {preview.targetAverage.toFixed(2)} →{" "}
                    <strong>{preview.targetNewAverage.toFixed(2)}</strong>
                  </p>
                  <p>
                    Stock investment{" "}
                    {preview.investmentChange === 0 ? (
                      <strong>unchanged</strong>
                    ) : (
                      <>
                        {preview.investmentChange > 0
                          ? "increases"
                          : "decreases"}{" "}
                        by <strong>{fmt(Math.abs(preview.investmentChange))}</strong>
                      </>
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={!canSave}>
              {isSaving ? "Saving…" : "Move units"}
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
