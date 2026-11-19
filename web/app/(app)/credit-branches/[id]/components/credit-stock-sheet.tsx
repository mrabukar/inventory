"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Sheet } from "@/components/ui/sheet";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import {
  BRANCH_PAYMENT_METHODS,
  branchPaymentMethodLabel,
  type BranchPaymentMethod,
  type CreditStockInput,
} from "@/types/credit-branches/credit-branch";

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface LineRow {
  key: number;
  productId?: string;
  qty: string;
  price: string;
}

let nextKey = 1;
const newRow = (): LineRow => ({ key: nextKey++, qty: "", price: "" });

interface Props {
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: CreditStockInput) => void;
}

export function CreditStockSheet({ isSaving, onClose, onSave }: Props) {
  const { data, isLoading } = useInventory({ limit: 100 });
  const [rows, setRows] = useState<LineRow[]>([newRow()]);
  const [note, setNote] = useState("");
  const [recordPayment, setRecordPayment] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidMethod, setPaidMethod] = useState<BranchPaymentMethod>("cash");
  const [paidReference, setPaidReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const warehouseStock = useMemo(
    () => (data?.data ?? []).filter((row) => row.quantity > 0),
    [data],
  );
  const productItems = warehouseStock.map((row) => ({
    value: row.productId,
    label: `${formatProductLabel(row.product.name, row.product.model)} (${row.quantity} in stock)`,
  }));
  const stockByProduct = useMemo(
    () => new Map(warehouseStock.map((row) => [row.productId, row])),
    [warehouseStock],
  );

  const addRow = () => setRows((r) => [...r, newRow()]);
  const removeRow = (key: number) =>
    setRows((r) => (r.length === 1 ? r : r.filter((row) => row.key !== key)));

  const setRow = (key: number, patch: Partial<LineRow>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const pickProduct = (key: number, productId: string | undefined) => {
    const stock = productId ? stockByProduct.get(productId) : undefined;
    setRow(key, {
      productId,
      price: stock ? String(toNumber(stock.product.sellingPrice)) : "",
    });
  };

  const total = rows.reduce((sum, row) => {
    const qty = parseInt(row.qty, 10);
    const price = parseFloat(row.price);
    if (!row.productId || Number.isNaN(qty) || Number.isNaN(price)) return sum;
    return sum + qty * price;
  }, 0);

  const save = () => {
    const items: CreditStockInput["items"] = [];
    for (const row of rows) {
      if (!row.productId) continue;
      const quantity = parseInt(row.qty, 10);
      const unitPrice = parseFloat(row.price);
      if (Number.isNaN(quantity) || quantity < 1) {
        setError("Enter a quantity of at least 1 for every line");
        return;
      }
      if (Number.isNaN(unitPrice) || unitPrice < 0) {
        setError("Enter a valid price for every line");
        return;
      }
      const stock = stockByProduct.get(row.productId);
      if (stock && quantity > stock.quantity) {
        setError(
          `Only ${stock.quantity} unit(s) of ${formatProductLabel(stock.product.name, stock.product.model)} are in stock`,
        );
        return;
      }
      items.push({ productId: row.productId, quantity, unitPrice });
    }
    if (items.length === 0) {
      setError("Add at least one product");
      return;
    }

    const paid = recordPayment ? parseFloat(paidAmount) : 0;
    if (recordPayment) {
      if (Number.isNaN(paid) || paid <= 0) {
        setError("Enter a valid amount paid");
        return;
      }
      if (paid > total + 0.001) {
        setError(`Amount paid can't exceed the total (${fmt(total)})`);
        return;
      }
    }

    setError(null);
    onSave({
      items,
      note: note.trim() || undefined,
      paidAmount: recordPayment ? paid : undefined,
      paidMethod: recordPayment ? paidMethod : undefined,
      paidReference: recordPayment ? paidReference.trim() || undefined : undefined,
    });
  };

  return (
    <Sheet
      title="Credit stock to this branch"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving || isLoading}>
            {isSaving ? "Crediting…" : `Credit ${fmt(total)}`}
          </Button>
        </>
      }
    >
      {error ? (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-2 rounded-md border border-border bg-muted/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Combobox
                  value={row.productId}
                  onValueChange={(v) => pickProduct(row.key, v)}
                  items={productItems}
                  placeholder="Select product"
                  searchPlaceholder="Search products…"
                  emptyText="No stock available."
                  className="w-full"
                />
              </div>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="dt-act danger"
                  onClick={() => removeRow(row.key)}
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Quantity
                </label>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={row.qty}
                  onChange={(e) =>
                    setRow(row.key, { qty: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Price per unit
                </label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={row.price}
                  onChange={(e) =>
                    setRow(row.key, {
                      price: e.target.value.replace(/[^0-9.]/g, ""),
                    })
                  }
                />
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          Add another product
        </Button>
      </div>

      <div className="mb-4 grid gap-2">
        <label className="text-sm font-medium leading-none">Note</label>
        <input
          className={inputCls}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={recordPayment}
          onChange={(e) => setRecordPayment(e.target.checked)}
        />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium leading-none">
            Record a payment now
          </span>
          <span className="text-sm text-muted-foreground">
            If the branch paid some or all of this at the time.
          </span>
        </span>
      </label>

      {recordPayment ? (
        <div className="mb-4 grid gap-3 rounded-md border border-border p-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">
              Amount paid
            </label>
            <input
              className={inputCls}
              inputMode="decimal"
              value={paidAmount}
              onChange={(e) =>
                setPaidAmount(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder={fmt(total)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">Method</label>
            <div className="flex flex-wrap gap-2">
              {BRANCH_PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaidMethod(m)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    paidMethod === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {branchPaymentMethodLabel(m)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">
              Reference
            </label>
            <input
              className={inputCls}
              value={paidReference}
              onChange={(e) => setPaidReference(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
