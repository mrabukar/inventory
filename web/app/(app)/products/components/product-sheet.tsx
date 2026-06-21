"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useProductPurchases } from "@/hooks/purchases/use-product-purchases";
import { formatDisplayDate } from "@/lib/filters/dates";
import { formatPriceInput, toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type { Product } from "@/types/products/product";

export interface ProductFormValues {
  name: string;
  categoryId: string;
  model: string;
  description: string;
  sellingPrice: string;
}

interface ProductSheetProps {
  initial?: Product;
  categories: { id: number; name: string }[];
  onClose: () => void;
  onSave: (data: ProductFormValues) => void;
  isSaving: boolean;
}

export function ProductSheet({
  initial,
  categories,
  onClose,
  onSave,
  isSaving,
}: ProductSheetProps) {
  const [form, setForm] = useState<ProductFormValues>({
    name: initial?.name ?? "",
    categoryId: String(initial?.categoryId ?? categories[0]?.id ?? ""),
    model: initial?.model ?? "",
    description: initial?.description ?? "",
    sellingPrice: initial ? formatPriceInput(initial.sellingPrice) : "",
  });
  const [err, setErr] = useState<Partial<ProductFormValues>>({});
  const { data: purchaseHistory } = useProductPurchases(initial?.id, {
    limit: 10,
  });
  const purchases = purchaseHistory?.data ?? [];
  const set = (key: keyof ProductFormValues, value: string) =>
    setForm((state) => ({ ...state, [key]: value }));

  const save = () => {
    const next: Partial<ProductFormValues> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.categoryId) next.categoryId = "Category is required";
    if (!form.sellingPrice || +form.sellingPrice <= 0)
      next.sellingPrice = "Enter a selling price";
    setErr(next);
    if (Object.keys(next).length) return;
    onSave(form);
  };

  return (
    <Sheet
      title={initial ? "Edit Product" : "Add Product"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <Field label="Category" required error={err.categoryId}>
        <select
          value={form.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Product name" required error={err.name}>
        <input
          className={`f-input${err.name ? " error" : ""}`}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. iPhone 15"
        />
      </Field>
      <Field label="Model">
        <input
          className="f-input"
          value={form.model}
          onChange={(e) => set("model", e.target.value)}
          placeholder="e.g. A15, A16"
        />
      </Field>
      <Field
        label="Selling price"
        required
        error={err.sellingPrice}
        helper="Unit cost is recorded when you create a purchase, not here."
      >
        <input
          className={`f-input${err.sellingPrice ? " error" : ""}`}
          type="number"
          value={form.sellingPrice}
          onChange={(e) => set("sellingPrice", e.target.value)}
          placeholder="0.00"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional description"
        />
      </Field>

      {initial ? (
        <div className="grid gap-2">
          <div className="text-sm font-medium">Purchase history</div>
          {initial.averageCost != null ? (
            <p className="text-sm text-muted-foreground">
              Current average cost: {fmt(toNumber(initial.averageCost))}
            </p>
          ) : null}
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No purchases recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b border-border/60">
                      <td className="px-3 py-2">
                        {formatDisplayDate(purchase.purchaseDate)}
                      </td>
                      <td className="px-3 py-2">{purchase.quantity}</td>
                      <td className="px-3 py-2">
                        {fmt(toNumber(purchase.unitPurchasePrice))}
                      </td>
                      <td className="px-3 py-2">
                        {fmt(toNumber(purchase.totalCost))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
