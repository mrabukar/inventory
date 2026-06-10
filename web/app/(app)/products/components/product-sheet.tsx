"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { toNumber } from "@/lib/reports/format";
import type { Product } from "@/types/products/product";

export interface ProductFormValues {
  name: string;
  categoryId: string;
  description: string;
  purchasePrice: string;
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
    description: initial?.description ?? "",
    purchasePrice: initial ? String(toNumber(initial.purchasePrice)) : "",
    sellingPrice: initial ? String(toNumber(initial.sellingPrice)) : "",
  });
  const [err, setErr] = useState<Partial<ProductFormValues>>({});
  const set = (key: keyof ProductFormValues, value: string) =>
    setForm((state) => ({ ...state, [key]: value }));

  const save = () => {
    const next: Partial<ProductFormValues> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.categoryId) next.categoryId = "Category is required";
    if (!form.purchasePrice || +form.purchasePrice <= 0)
      next.purchasePrice = "Enter a purchase price";
    if (!form.sellingPrice || +form.sellingPrice <= 0)
      next.sellingPrice = "Enter a selling price";
    else if (+form.sellingPrice < +form.purchasePrice)
      next.sellingPrice = "Selling price must be ≥ purchase price";
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
      <Field label="Product name" required error={err.name}>
        <input
          className={`f-input${err.name ? " error" : ""}`}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. iPhone 15"
        />
      </Field>
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
      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional description"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Purchase price" required error={err.purchasePrice}>
          <input
            className={`f-input${err.purchasePrice ? " error" : ""}`}
            type="number"
            value={form.purchasePrice}
            onChange={(e) => set("purchasePrice", e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Selling price" required error={err.sellingPrice}>
          <input
            className={`f-input${err.sellingPrice ? " error" : ""}`}
            type="number"
            value={form.sellingPrice}
            onChange={(e) => set("sellingPrice", e.target.value)}
            placeholder="0.00"
          />
        </Field>
      </div>
    </Sheet>
  );
}
