"use client";

import { useMemo, useState } from "react";

import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { formatProductLabel } from "@/lib/products/format";
import { formatSaleDate, toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type { CorrectSaleItemInput } from "@/types/sales/create-sale";
import type { Sale } from "@/types/sales/sale";

interface CorrectionSheetProps {
  sale: Sale;
  onClose: () => void;
  onSave: (items: CorrectSaleItemInput[], reason: string) => void;
  isSaving: boolean;
}

export function CorrectionSheet({
  sale,
  onClose,
  onSave,
  isSaving,
}: CorrectionSheetProps) {
  const itemById = useMemo(
    () => new Map(sale.items.map((item) => [item.id, item])),
    [sale.items],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    sale.items.length === 1 && sale.items[0] ? [sale.items[0].id] : [],
  );
  const [qtys, setQtys] = useState<Record<string, string>>(() => {
    if (sale.items.length === 1 && sale.items[0]) {
      return { [sale.items[0].id]: String(sale.items[0].quantitySold) };
    }
    return {};
  });
  const [picking, setPicking] = useState(() => sale.items.length > 1);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<{ items?: string; reason?: string }>({});

  const availableOptions = sale.items
    .filter((item) => !selectedIds.includes(item.id))
    .map((item) => ({
      value: item.id,
      label: `${formatProductLabel(item.product.name, item.product.model)} (${item.quantitySold})`,
    }));

  const addItem = (id: string | undefined) => {
    if (!id || selectedIds.includes(id)) return;
    const item = itemById.get(id);
    if (!item) return;
    setSelectedIds((prev) => [...prev, id]);
    setQtys((prev) => ({ ...prev, [id]: String(item.quantitySold) }));
    setPicking(false);
    setErr((prev) => ({ ...prev, items: undefined }));
  };

  const removeItem = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setQtys((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setQty = (itemId: string, next: string) => {
    setQtys((prev) => ({
      ...prev,
      [itemId]: next === "" ? "" : next.replace(/\D/g, ""),
    }));
  };

  const save = () => {
    const e: typeof err = {};
    const changed: CorrectSaleItemInput[] = [];
    let hasInvalid = false;

    if (selectedIds.length === 0) {
      e.items = "Select at least one item to correct";
    } else {
      for (const id of selectedIds) {
        const item = itemById.get(id);
        if (!item) continue;
        const raw = qtys[id] ?? "";
        const parsed = raw === "" ? NaN : parseInt(raw, 10);
        if (raw === "" || Number.isNaN(parsed) || parsed < 1) {
          hasInvalid = true;
          continue;
        }
        if (parsed !== item.quantitySold) {
          changed.push({ saleItemId: id, correctedQuantity: parsed });
        }
      }
      if (hasInvalid)
        e.items = "Enter a valid quantity (1+) for every selected item";
      else if (changed.length === 0)
        e.items = "Change at least one quantity to submit a correction";
    }
    if (!reason.trim()) e.reason = "Reason is required";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave(changed, reason.trim());
  };

  const canAddMore = availableOptions.length > 0;

  const hasValidChanges = useMemo(() => {
    if (selectedIds.length === 0) return false;
    let anyChanged = false;
    for (const id of selectedIds) {
      const item = itemById.get(id);
      if (!item) return false;
      const raw = qtys[id] ?? "";
      const parsed = raw === "" ? NaN : parseInt(raw, 10);
      if (raw === "" || Number.isNaN(parsed) || parsed < 1) return false;
      if (parsed !== item.quantitySold) anyChanged = true;
    }
    return anyChanged;
  }, [selectedIds, qtys, itemById]);

  // If the customer has already paid more than the corrected total, the app
  // can't record a refund: tell the admin so they can settle it outside.
  const overpaid = useMemo(() => {
    if (!sale.invoice) return 0;
    const paid = toNumber(sale.invoice.paidAmount);
    const newTotal = sale.items.reduce((sum, item) => {
      const raw = selectedIds.includes(item.id) ? qtys[item.id] : undefined;
      const parsed = raw == null || raw === "" ? NaN : parseInt(raw, 10);
      const qty =
        Number.isNaN(parsed) || parsed < 1 ? item.quantitySold : parsed;
      return sum + toNumber(item.unitPrice) * qty;
    }, 0);
    const excess = Math.round((paid - newTotal) * 100) / 100;
    return excess > 0 ? excess : 0;
  }, [sale.invoice, sale.items, selectedIds, qtys]);

  const canSubmit = !isSaving && hasValidChanges && reason.trim().length > 0;

  return (
    <Sheet
      title="Correct Sale"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSubmit}>
            {isSaving ? "Submitting…" : "Submit Correction"}
          </Button>
        </>
      }
    >
      <div className="mb-4 text-sm text-muted-foreground">
        Sale date: {formatSaleDate(sale.saleDate)}
      </div>

      <div className="mb-4 space-y-3">
        {selectedIds.map((id) => {
          const item = itemById.get(id);
          if (!item) return null;
          const label = formatProductLabel(
            item.product.name,
            item.product.model,
          );
          return (
            <div
              key={id}
              className="rounded-md border border-border bg-muted/30 p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="font-semibold">{label}</div>
                {sale.items.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(id)}
                    disabled={isSaving}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="mb-2 text-sm text-muted-foreground">
                Current quantity:{" "}
                <b className="text-foreground">{item.quantitySold}</b>
              </div>
              <Field label="Corrected quantity" required>
                <input
                  className={`f-input${err.items ? " error" : ""}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={qtys[id] ?? ""}
                  onChange={(e) => setQty(id, e.target.value)}
                  aria-label={`Corrected quantity for ${label}`}
                />
              </Field>
            </div>
          );
        })}

        {picking && canAddMore ? (
          <Field label="Item" required={selectedIds.length === 0}>
            <Combobox
              value={undefined}
              onValueChange={addItem}
              items={availableOptions}
              placeholder="Select item"
              className="w-full"
            />
          </Field>
        ) : null}

        {!picking && canAddMore ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPicking(true)}
            disabled={isSaving}
          >
            Add another item
          </Button>
        ) : null}

        {err.items ? (
          <p className="text-sm text-destructive">{err.items}</p>
        ) : null}
      </div>

      {overpaid > 0 ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800"
        >
          The customer has already paid {fmt(toNumber(sale.invoice!.paidAmount))}.
          After this correction the sale is worth less, so {fmt(overpaid)} is
          owed back. Refund it outside the app. The invoice will show the new
          total as paid and no refund is recorded.
        </div>
      ) : null}

      <Field label="Reason" required error={err.reason}>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this sale is being corrected"
        />
      </Field>
    </Sheet>
  );
}
