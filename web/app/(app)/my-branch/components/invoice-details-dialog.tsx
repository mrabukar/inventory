"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CreditBranch,
  UpdateCreditBranchInput,
} from "@/types/credit-branches/credit-branch";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface Props {
  branch: CreditBranch;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: UpdateCreditBranchInput) => void;
}

export function InvoiceDetailsDialog({
  branch,
  isSaving,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState({
    phone: branch.phone ?? "",
    evcNumber: branch.evcNumber ?? "",
    edahabNumber: branch.edahabNumber ?? "",
    accountNumber: branch.accountNumber ?? "",
  });

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: "phone", label: "Phone" },
    { key: "evcNumber", label: "EVC number" },
    { key: "edahabNumber", label: "eDahab number" },
    { key: "accountNumber", label: "Bank account" },
  ];

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] grid max-h-[92vh] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto border border-border bg-background p-6 shadow-lg sm:rounded-lg">
          <div className="grid gap-1.5 pr-6">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Invoice details
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              These are printed on your invoices so customers know how to pay
              you. Leave one empty to remove it.
            </Dialog.Description>
          </div>

          <div className="grid gap-4">
            {fields.map(({ key, label }) => (
              <div key={key} className="grid gap-1.5">
                <label
                  htmlFor={`invoice-detail-${key}`}
                  className="text-sm font-medium leading-none"
                >
                  {label}
                </label>
                <input
                  id={`invoice-detail-${key}`}
                  className={inputCls}
                  value={form[key]}
                  disabled={isSaving}
                  placeholder="Optional"
                  onChange={(e) =>
                    setForm((s) => ({ ...s, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
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
            <Button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onSave({
                  phone: form.phone.trim(),
                  evcNumber: form.evcNumber.trim(),
                  edahabNumber: form.edahabNumber.trim(),
                  accountNumber: form.accountNumber.trim(),
                })
              }
            >
              {isSaving ? "Saving…" : "Save details"}
            </Button>
          </div>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            disabled={isSaving}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
