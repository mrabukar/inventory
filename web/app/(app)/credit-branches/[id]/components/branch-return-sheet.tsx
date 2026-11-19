"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Sheet } from "@/components/ui/sheet";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type {
  BranchCredit,
  CreateBranchReturnInput,
} from "@/types/credit-branches/credit-branch";

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface ReturnableLine {
  value: string;
  label: string;
  unitPrice: number;
  remaining: number;
}

interface Props {
  credits: BranchCredit[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: CreateBranchReturnInput) => void;
}

export function BranchReturnSheet({ credits, isSaving, onClose, onSave }: Props) {
  const lines = useMemo<ReturnableLine[]>(
    () =>
      credits.flatMap((credit) =>
        credit.items
          .map((item) => {
            const returned = item.returns.reduce((sum, r) => sum + r.quantity, 0);
            const remaining = item.quantity - returned;
            return {
              value: item.id,
              label: `${formatProductLabel(item.product.name, item.product.model)} — ${remaining} of ${item.quantity} left to return @ ${fmt(toNumber(item.unitPrice))}`,
              unitPrice: toNumber(item.unitPrice),
              remaining,
            };
          })
          .filter((line) => line.remaining > 0),
      ),
    [credits],
  );

  const [lineId, setLineId] = useState<string | undefined>();
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const line = lines.find((l) => l.value === lineId);
  const parsedQty = parseInt(quantity, 10);
  const amount =
    line && !Number.isNaN(parsedQty) ? line.unitPrice * parsedQty : 0;

  const save = () => {
    if (!lineId) {
      setError("Select which credited line this return is for");
      return;
    }
    if (Number.isNaN(parsedQty) || parsedQty < 1) {
      setError("Enter a quantity of at least 1");
      return;
    }
    if (line && parsedQty > line.remaining) {
      setError(`Only ${line.remaining} unit(s) remain to be returned`);
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    setError(null);
    onSave({ branchCreditItemId: lineId, quantity: parsedQty, reason: reason.trim() });
  };

  return (
    <Sheet
      title="Record a return"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? "Saving…" : "Record return"}
          </Button>
        </>
      }
    >
      {error ? (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing has been credited to this branch yet.
        </p>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">
              Credited item <span className="text-destructive">*</span>
            </label>
            <Combobox
              value={lineId}
              onValueChange={setLineId}
              items={lines}
              placeholder="Select a credited line"
              className="w-full"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">
              Quantity returned <span className="text-destructive">*</span>
            </label>
            <input
              className={inputCls}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
            />
            {amount > 0 ? (
              <p className="text-sm text-muted-foreground">
                Lowers the balance by {fmt(amount)}.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              className={inputCls}
              style={{ height: 80, resize: "vertical", paddingTop: 8 }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Damaged on arrival"
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}
