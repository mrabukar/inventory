"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { cn } from "@/lib/utils";
import { formatProductLabel } from "@/lib/products/format";
import { formatPriceInput, toNumber } from "@/lib/reports/format";
import { todayYmd } from "@/lib/filters/dates";
import { grossMarginPercent } from "@/lib/purchases/weighted-average";
import type { SetOpeningCostInput } from "@/service/products/set-opening-cost";
import type { Product } from "@/types/products/product";

interface OpeningCostModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSave: (input: SetOpeningCostInput) => void;
  isSaving: boolean;
}

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function OpeningCostModal({
  open,
  product,
  onClose,
  onSave,
  isSaving,
}: OpeningCostModalProps) {
  const [unitCost, setUnitCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayYmd());
  const [note, setNote] = useState("");
  const [updateSellingPrice, setUpdateSellingPrice] = useState(false);
  const [newSellingPrice, setNewSellingPrice] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [lossConfirm, setLossConfirm] = useState<SetOpeningCostInput | null>(
    null,
  );

  const { data: inventoryData } = useInventory(
    { productId: product?.id, limit: 100 },
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

  const unitCostNum = Number(unitCost) || 0;
  const sellingPrice = product ? toNumber(product.sellingPrice) : 0;
  const effectiveSelling = updateSellingPrice
    ? Number(newSellingPrice) || 0
    : sellingPrice;
  const margin =
    unitCostNum > 0 && effectiveSelling > 0
      ? grossMarginPercent(effectiveSelling, unitCostNum)
      : null;
  const showLossWarning =
    unitCostNum > 0 && effectiveSelling > 0 && unitCostNum > effectiveSelling;

  useEffect(() => {
    if (!open || !product) return;
    setUnitCost("");
    setPurchaseDate(todayYmd());
    setNote("");
    setUpdateSellingPrice(false);
    setNewSellingPrice(formatPriceInput(product.sellingPrice));
    setErr({});
    setLossConfirm(null);
  }, [open, product]);

  const resetForm = () => {
    if (!product) return;
    setUnitCost("");
    setPurchaseDate(todayYmd());
    setNote("");
    setUpdateSellingPrice(false);
    setNewSellingPrice(formatPriceInput(product.sellingPrice));
    setErr({});
    setLossConfirm(null);
  };

  const buildPayload = (): SetOpeningCostInput | null => {
    const next: Record<string, string> = {};
    if (!unitCost || unitCostNum <= 0) {
      next.unitCost = "Enter a unit cost";
    }
    if (!purchaseDate) next.purchaseDate = "Date is required";
    if (updateSellingPrice && (!newSellingPrice || Number(newSellingPrice) <= 0)) {
      next.newSellingPrice = "Enter a selling price";
    }
    setErr(next);
    if (Object.keys(next).length) return null;

    return {
      unitPurchasePrice: unitCostNum,
      purchaseDate,
      note: note.trim() || undefined,
      ...(updateSellingPrice
        ? { newSellingPrice: Number(newSellingPrice) }
        : undefined),
    };
  };

  const submit = (payload: SetOpeningCostInput) => {
    onSave(payload);
    setLossConfirm(null);
  };

  const save = () => {
    const payload = buildPayload();
    if (!payload) return;

    if (payload.unitPurchasePrice <= effectiveSelling) {
      submit(payload);
      return;
    }

    if (
      updateSellingPrice &&
      payload.newSellingPrice !== undefined &&
      payload.newSellingPrice >= payload.unitPurchasePrice
    ) {
      submit(payload);
      return;
    }

    const needsPriceOverride =
      updateSellingPrice && payload.newSellingPrice !== undefined;

    setLossConfirm(
      needsPriceOverride
        ? {
            ...payload,
            acceptSellingBelowCost: true,
          }
        : payload,
    );
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
          resetForm();
        } else if (product) {
          resetForm();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg sm:max-h-[90vh] sm:overflow-y-auto sm:rounded-lg",
          )}
        >
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold">
              Set opening cost
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Assign average cost to stock already on hand. Quantities stay the
              same — use Record Purchase when new stock arrives.
            </Dialog.Description>
          </div>

          {product ? (
            <div className="grid gap-4 py-2">
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                <div className="font-medium">
                  {formatProductLabel(product.name, product.model)}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {onHand > 0
                    ? `${onHand} unit${onHand === 1 ? "" : "s"} on hand across all locations`
                    : "Loading stock…"}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Unit cost <span className="text-destructive">*</span>
                </label>
                <input
                  className={cn(inputClassName, err.unitCost && "border-destructive")}
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="What you paid per unit"
                />
                {err.unitCost ? (
                  <p className="text-sm text-destructive">{err.unitCost}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  As-of date <span className="text-destructive">*</span>
                </label>
                <input
                  className={cn(
                    inputClassName,
                    err.purchaseDate && "border-destructive",
                  )}
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Note</label>
                <textarea
                  className={cn(inputClassName, "min-h-[72px] resize-y py-2")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional — e.g. Legacy stock from before purchasing"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={updateSellingPrice}
                  onChange={(e) => setUpdateSellingPrice(e.target.checked)}
                />
                Update selling price
              </label>

              {updateSellingPrice ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">New selling price</label>
                  <input
                    className={cn(
                      inputClassName,
                      err.newSellingPrice && "border-destructive",
                    )}
                    type="number"
                    min={0}
                    step="0.01"
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(e.target.value)}
                  />
                </div>
              ) : null}

              {margin != null ? (
                <div
                  className={cn(
                    "rounded-md border p-3 text-sm",
                    showLossWarning
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-border bg-muted/40",
                  )}
                >
                  {showLossWarning ? (
                    <p className="mb-2 flex items-start gap-2 font-medium">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      Unit cost exceeds selling price.
                    </p>
                  ) : null}
                  <p>
                    Average cost will be <strong>{unitCostNum.toFixed(2)}</strong>
                    {onHand > 0 ? (
                      <>
                        {" "}
                        → stock value{" "}
                        <strong>{(onHand * unitCostNum).toFixed(2)}</strong>
                      </>
                    ) : null}
                  </p>
                  <p>
                    Margin at {effectiveSelling.toFixed(2)}:{" "}
                    <strong>{margin.toFixed(1)}%</strong>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={isSaving || !product || onHand <= 0}
            >
              {isSaving ? "Saving…" : "Set opening cost"}
            </Button>
          </div>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70"
            onClick={onClose}
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>

      {lossConfirm ? (
        <ConfirmDialog
          title="Selling at a loss?"
          message="Unit cost exceeds the selling price. Opening cost will still be saved."
          confirmLabel="Save anyway"
          variant="danger"
          isLoading={isSaving}
          onConfirm={() => submit(lossConfirm)}
          onClose={() => setLossConfirm(null)}
        />
      ) : null}
    </Dialog.Root>
  );
}
