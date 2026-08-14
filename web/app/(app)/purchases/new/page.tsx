"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Combobox } from "@/components/ui/combobox";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { useProducts } from "@/hooks/products/use-products";
import { useCreatePurchaseBatch } from "@/hooks/purchases/use-create-purchase-batch";
import { todayYmd } from "@/lib/filters/dates";
import { formatProductLabel } from "@/lib/products/format";
import { formatPriceInput, toNumber } from "@/lib/reports/format";
import { productUnitCost } from "@/lib/products/unit-cost";
import {
  computeWeightedAverageCost,
  grossMarginPercent,
} from "@/lib/purchases/weighted-average";
import { cn, fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type {
  CreatePurchaseBatchInput,
  CreatePurchaseBatchItemInput,
} from "@/types/purchases/purchase";
import type { Product } from "@/types/products/product";

// ── Helpers ──────────────────────────────────────────────────────────────────

let nextRowId = 1;
function makeRow(): RowState {
  return {
    id: String(nextRowId++),
    productId: "",
    quantity: "",
    unitPurchasePrice: "",
    updateSellingPrice: false,
    newSellingPrice: "",
    error: {},
  };
}

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

// ── Row state ─────────────────────────────────────────────────────────────────

interface RowState {
  id: string;
  productId: string;
  quantity: string;
  unitPurchasePrice: string;
  updateSellingPrice: boolean;
  newSellingPrice: string;
  error: Partial<
    Record<
      "productId" | "quantity" | "unitPurchasePrice" | "newSellingPrice",
      string
    >
  >;
}

// ── Per-row component ─────────────────────────────────────────────────────────

interface PurchaseRowProps {
  row: RowState;
  products: Product[];
  excludedProductIds: string[];
  canRemove: boolean;
  onChange: (id: string, patch: Partial<RowState>) => void;
  onRemove: (id: string) => void;
}

function PurchaseRow({
  row,
  products,
  excludedProductIds,
  canRemove,
  onChange,
  onRemove,
}: PurchaseRowProps) {
  // Per-row inventory fetch for the weighted-average preview
  const { data: inventoryData } = useInventory(
    { productId: row.productId || undefined, limit: 100 },
    "all",
  );

  const onHand = useMemo(
    () => (inventoryData?.data ?? []).reduce((sum, r) => sum + r.quantity, 0),
    [inventoryData?.data],
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === row.productId),
    [products, row.productId],
  );

  const productItems = useMemo(
    () =>
      products
        .filter(
          (p) => p.id === row.productId || !excludedProductIds.includes(p.id),
        )
        .map((p) => ({
          value: p.id,
          label: formatProductLabel(p.name, p.model),
          keywords: [p.name, p.model ?? "", p.category?.name ?? ""],
        })),
    [products, row.productId, excludedProductIds],
  );

  const preview = useMemo(() => {
    if (!selectedProduct || !row.quantity || !row.unitPurchasePrice)
      return null;
    const qty = Number(row.quantity);
    const unitCost = Number(row.unitPurchasePrice);
    if (qty <= 0 || unitCost <= 0) return null;

    const currentAverage = toNumber(selectedProduct.averageCost);
    const newAverage = computeWeightedAverageCost(
      onHand,
      currentAverage,
      qty,
      unitCost,
    );
    const sellingPrice = row.updateSellingPrice
      ? Number(row.newSellingPrice) || 0
      : toNumber(selectedProduct.sellingPrice);
    const margin = grossMarginPercent(sellingPrice, newAverage);

    return { newAverage, sellingPrice, margin };
  }, [selectedProduct, row, onHand]);

  const unitCost = Number(row.unitPurchasePrice) || 0;
  const currentSellingPrice = selectedProduct
    ? toNumber(selectedProduct.sellingPrice)
    : 0;
  const effectiveSellingPrice = row.updateSellingPrice
    ? Number(row.newSellingPrice) || 0
    : currentSellingPrice;
  const isLoss =
    unitCost > 0 &&
    effectiveSellingPrice > 0 &&
    unitCost > effectiveSellingPrice;
  const showWarning = isLoss || Boolean(preview && preview.margin < 0);

  const selectProduct = useCallback(
    (productId: string | undefined) => {
      const product = products.find((p) => p.id === productId);
      const costHint =
        product && productUnitCost(product) > 0
          ? formatPriceInput(productUnitCost(product))
          : "";
      const hintCost = costHint ? Number(costHint) : 0;
      const currentSelling = product ? toNumber(product.sellingPrice) : 0;
      const autoUpdate = Boolean(product && hintCost > currentSelling);

      onChange(row.id, {
        productId: productId ?? "",
        unitPurchasePrice: costHint,
        updateSellingPrice: autoUpdate,
        newSellingPrice: product
          ? formatPriceInput(
              autoUpdate ? Math.max(currentSelling, hintCost) : currentSelling,
            )
          : row.newSellingPrice,
        error: { ...row.error, productId: undefined },
      });
    },
    [products, row.id, row.error, row.newSellingPrice, onChange],
  );

  const setUnitPrice = useCallback(
    (value: string) => {
      const cost = Number(value);
      const product = products.find((p) => p.id === row.productId);
      const patch: Partial<RowState> = {
        unitPurchasePrice: value,
        error: { ...row.error, unitPurchasePrice: undefined },
      };
      if (product && cost > 0 && cost > toNumber(product.sellingPrice)) {
        patch.updateSellingPrice = true;
        patch.newSellingPrice = formatPriceInput(
          Math.max(toNumber(product.sellingPrice), cost),
        );
      }
      onChange(row.id, patch);
    },
    [products, row.id, row.productId, row.error, onChange],
  );

  return (
    <div className="rounded-lg border border-border bg-background p-4 grid gap-3">
      {/* Row header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-sm font-medium">
            Product <span className="text-destructive">*</span>
          </label>
          <Combobox
            value={row.productId || undefined}
            onValueChange={selectProduct}
            items={productItems}
            placeholder="Select a product…"
            searchPlaceholder="Search products…"
            emptyText="No products found."
            className="mt-1.5 w-full"
            popoverClassName="z-[200]"
          />
          {row.error.productId ? (
            <p className="mt-1 text-xs text-destructive">
              {row.error.productId}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="dt-act mt-7 shrink-0"
          title="Remove row"
          onClick={() => onRemove(row.id)}
          disabled={!canRemove}
          style={!canRemove ? { opacity: 0.35 } : undefined}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Qty + cost */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">
            Quantity <span className="text-destructive">*</span>
          </label>
          <input
            className={cn(inputCls, row.error.quantity && "border-destructive")}
            type="number"
            min={1}
            value={row.quantity}
            onChange={(e) =>
              onChange(row.id, {
                quantity: e.target.value,
                error: { ...row.error, quantity: undefined },
              })
            }
            placeholder="e.g. 20"
            disabled={!row.productId}
          />
          {row.error.quantity ? (
            <p className="text-xs text-destructive">{row.error.quantity}</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium">
            Unit cost <span className="text-destructive">*</span>
          </label>
          <input
            className={cn(
              inputCls,
              row.error.unitPurchasePrice && "border-destructive",
            )}
            type="number"
            min={0}
            step="0.01"
            value={row.unitPurchasePrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="0.00"
            disabled={!row.productId}
          />
          {row.error.unitPurchasePrice ? (
            <p className="text-xs text-destructive">
              {row.error.unitPurchasePrice}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5 col-span-2 sm:col-span-1">
          <label className="text-sm font-medium text-muted-foreground">
            Total cost
          </label>
          <div
            className={cn(
              inputCls,
              "cursor-default select-none bg-muted/40 text-muted-foreground",
            )}
          >
            {row.quantity && row.unitPurchasePrice
              ? fmt(Number(row.quantity) * Number(row.unitPurchasePrice))
              : "—"}
          </div>
        </div>
      </div>

      {/* Selling price update */}
      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={row.updateSellingPrice}
            onChange={(e) =>
              onChange(row.id, { updateSellingPrice: e.target.checked })
            }
            disabled={!row.productId}
          />
          Update selling price
          {selectedProduct && !row.updateSellingPrice ? (
            <span className="text-muted-foreground font-normal">
              (current: {fmt(toNumber(selectedProduct.sellingPrice))})
            </span>
          ) : null}
        </label>

        {row.updateSellingPrice ? (
          <div className="ml-5 grid gap-1.5 max-w-[200px]">
            <input
              className={cn(
                inputCls,
                row.error.newSellingPrice && "border-destructive",
              )}
              type="number"
              min={0}
              step="0.01"
              value={row.newSellingPrice}
              onChange={(e) =>
                onChange(row.id, {
                  newSellingPrice: e.target.value,
                  error: { ...row.error, newSellingPrice: undefined },
                })
              }
              placeholder="0.00"
            />
            {row.error.newSellingPrice ? (
              <p className="text-xs text-destructive">
                {row.error.newSellingPrice}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Preview */}
      {preview ? (
        <div
          className={cn(
            "rounded-md border p-3 text-sm",
            showWarning
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-border bg-muted/40",
          )}
        >
          {showWarning ? (
            <p className="mb-1.5 flex items-start gap-2 font-medium">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {isLoss
                ? "Unit cost exceeds selling price — selling at a loss."
                : "Projected margin is negative at this average cost."}
            </p>
          ) : null}
          <p>
            New average cost: <strong>{preview.newAverage.toFixed(2)}</strong>
          </p>
          <p>
            At selling price {preview.sellingPrice.toFixed(2)} → margin{" "}
            <strong>{preview.margin.toFixed(1)}%</strong>
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateRows(rows: RowState[]): {
  rows: RowState[];
  valid: boolean;
} {
  const next = rows.map((row) => {
    const error: RowState["error"] = {};
    if (!row.productId) error.productId = "Select a product";
    if (!row.quantity || Number(row.quantity) <= 0)
      error.quantity = "Enter a positive quantity";
    if (!row.unitPurchasePrice || Number(row.unitPurchasePrice) <= 0)
      error.unitPurchasePrice = "Enter a unit cost";
    if (
      row.updateSellingPrice &&
      (!row.newSellingPrice || Number(row.newSellingPrice) <= 0)
    )
      error.newSellingPrice = "Enter a selling price";
    return { ...row, error };
  });
  return {
    rows: next,
    valid: next.every((r) => Object.keys(r.error).length === 0),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecordPurchasePage() {
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);

  const { data: productsData } = useProducts({ limit: 100 }); // ! limit must not be greater than 100
  const products = useMemo(
    () => productsData?.data ?? [],
    [productsData?.data],
  );

  const createBatch = useCreatePurchaseBatch();

  // Shared header fields
  const [purchaseDate, setPurchaseDate] = useState(todayYmd());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [note, setNote] = useState("");

  // Row array
  const [rows, setRows] = useState<RowState[]>([makeRow()]);

  // Loss confirmation
  const [lossConfirm, setLossConfirm] = useState<{
    payload: CreatePurchaseBatchInput;
    items: string[]; // product names with a loss
  } | null>(null);

  // Header validation error
  const [dateError, setDateError] = useState("");

  // ── Row helpers ─────────────────────────────────────────────────────────────

  const selectedProductIds = useMemo(
    () => rows.map((r) => r.productId).filter(Boolean),
    [rows],
  );

  const updateRow = useCallback(
    (id: string, patch: Partial<RowState>) =>
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      ),
    [],
  );

  const removeRow = useCallback(
    (id: string) =>
      setRows((prev) =>
        prev.length === 1 ? prev : prev.filter((r) => r.id !== id),
      ),
    [],
  );

  const addRow = () => setRows((prev) => [...prev, makeRow()]);

  // ── Submit logic ────────────────────────────────────────────────────────────

  const buildPayload = (
    acceptLoss: boolean,
  ): CreatePurchaseBatchInput | null => {
    // Header validation
    if (!purchaseDate) {
      setDateError("Purchase date is required");
      return null;
    }
    setDateError("");

    // Row validation
    const { rows: validated, valid } = validateRows(rows);
    setRows(validated);
    if (!valid) return null;

    return {
      purchaseDate,
      invoiceNumber: invoiceNumber.trim() || undefined,
      note: note.trim() || undefined,
      items: validated.map((row): CreatePurchaseBatchItemInput => {
        const product = products.find((p) => p.id === row.productId)!;
        const unitCost = Number(row.unitPurchasePrice);
        const effectiveSelling = row.updateSellingPrice
          ? Number(row.newSellingPrice)
          : toNumber(product.sellingPrice);
        const isRowLoss = unitCost > effectiveSelling;

        return {
          productId: row.productId,
          quantity: Number(row.quantity),
          unitPurchasePrice: unitCost,
          ...(row.updateSellingPrice
            ? { newSellingPrice: Number(row.newSellingPrice) }
            : undefined),
          ...(isRowLoss && acceptLoss
            ? { acceptSellingBelowCost: true }
            : undefined),
        };
      }),
    };
  };

  const handleSubmit = () => {
    const payload = buildPayload(false);
    if (!payload) return;

    // Identify loss rows
    const lossItems = payload.items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        const selling = item.newSellingPrice ?? toNumber(product.sellingPrice);
        if (item.unitPurchasePrice > selling) {
          return formatProductLabel(product.name, product.model);
        }
        return null;
      })
      .filter((name): name is string => name !== null);

    if (lossItems.length > 0) {
      setLossConfirm({ payload, items: lossItems });
      return;
    }

    void doSave(payload);
  };

  const handleConfirmLoss = () => {
    if (!lossConfirm) return;
    const payload = buildPayload(true);
    if (!payload) return;
    void doSave(payload);
    setLossConfirm(null);
  };

  const doSave = async (payload: CreatePurchaseBatchInput) => {
    try {
      await createBatch.mutateAsync(payload);
      const n = payload.items.length;
      addToast({
        title: `${n} purchase${n === 1 ? "" : "s"} recorded successfully`,
      });
      router.push("/purchases");
    } catch (e) {
      addErrorToast({
        title: "Failed to record purchases",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  // ── Derived state ───────────────────────────────────────────────────────────

  const grandTotal = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const q = Number(r.quantity) || 0;
        const c = Number(r.unitPurchasePrice) || 0;
        return sum + q * c;
      }, 0),
    [rows],
  );

  const validRowCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.productId &&
          Number(r.quantity) > 0 &&
          Number(r.unitPurchasePrice) > 0 &&
          (!r.updateSellingPrice || Number(r.newSellingPrice) > 0),
      ).length,
    [rows],
  );

  const canSubmit =
    validRowCount === rows.length && rows.length > 0 && !createBatch.isPending;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Page header */}
      <div className="page-head">
        <div>
          <button
            type="button"
            onClick={() => router.push("/purchases")}
            className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Purchases
          </button>
          <h1>Record Purchase</h1>
          <p className="ph-desc">
            Stock is added to the organisation warehouse. Average cost updates
            automatically.
          </p>
        </div>
      </div>

      <Card bodyClass="px-5 py-5">
        <div className="grid gap-6">
          {/* ── Shared header fields ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Purchase date <span className="text-destructive">*</span>
              </label>
              <input
                className={cn(inputCls, dateError && "border-destructive")}
                type="date"
                value={purchaseDate}
                onChange={(e) => {
                  setPurchaseDate(e.target.value);
                  if (dateError) setDateError("");
                }}
              />
              {dateError ? (
                <p className="text-xs text-destructive">{dateError}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Invoice number</label>
              <input
                className={inputCls}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Vendor's ref — optional"
                maxLength={100}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Note</label>
              <input
                className={inputCls}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                maxLength={500}
              />
            </div>
          </div>

          {/* ── Product rows ── */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Items{" "}
                <span className="text-muted-foreground font-normal">
                  ({rows.length})
                </span>
              </p>
            </div>

            {rows.map((row) => (
              <PurchaseRow
                key={row.id}
                row={row}
                products={products}
                excludedProductIds={selectedProductIds}
                canRemove={rows.length > 1}
                onChange={updateRow}
                onRemove={removeRow}
              />
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={addRow}
            >
              <Plus className="size-4" />
              Add item
            </Button>
          </div>

          {/* ── Footer / submit ── */}
          <div
            className="flex flex-col gap-3 rounded-md px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: "var(--tint-indigo)" }}
          >
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Grand total</p>
              <p
                className="num text-2xl font-bold leading-tight"
                style={{ color: "var(--brand-indigo)" }}
              >
                {fmt(grandTotal)}
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/purchases")}
                disabled={createBatch.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {createBatch.isPending
                  ? "Saving…"
                  : `Record ${rows.length} purchase${rows.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Loss confirmation ── */}
      {lossConfirm ? (
        <ConfirmDialog
          title="Selling at a loss?"
          message={`The following items have a unit cost above their selling price:\n\n${lossConfirm.items.map((n) => `• ${n}`).join("\n")}\n\nThe purchase will still be recorded. Review selling prices after saving.`}
          confirmLabel="Record anyway — selling at a loss"
          variant="danger"
          isLoading={createBatch.isPending}
          onConfirm={handleConfirmLoss}
          onClose={() => setLossConfirm(null)}
        />
      ) : null}
    </div>
  );
}
