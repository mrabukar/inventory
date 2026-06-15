"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import type { Store } from "@/types/stores/store";

export interface StoreFormValues {
  name: string;
  address: string;
}

interface StoreSheetProps {
  initial?: Store;
  onClose: () => void;
  onSave: (data: StoreFormValues) => void;
  isSaving: boolean;
}

export function StoreSheet({ initial, onClose, onSave, isSaving }: StoreSheetProps) {
  const [form, setForm] = useState<StoreFormValues>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
  });
  const [err, setErr] = useState<Partial<StoreFormValues>>({});
  const set = (key: keyof StoreFormValues, value: string) =>
    setForm((state) => ({ ...state, [key]: value }));

  const save = () => {
    const next: Partial<StoreFormValues> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.address.trim()) next.address = "Address is required";
    setErr(next);
    if (Object.keys(next).length) return;
    onSave(form);
  };

  return (
    <Sheet
      title={initial ? "Edit Store" : "Add Store"}
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
      <Field label="Store name" required error={err.name}>
        <input
          className={`f-input${err.name ? " error" : ""}`}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Main Branch"
        />
      </Field>
      <Field label="Address" required error={err.address}>
        <textarea
          className={err.address ? "error" : undefined}
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="e.g. 123 Main St, City"
        />
      </Field>
    </Sheet>
  );
}
