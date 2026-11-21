"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CreateCreditBranchInput,
  CreditBranch,
} from "@/types/credit-branches/credit-branch";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const contentCls = cn(
  "fixed left-1/2 top-1/2 z-[60] grid max-h-[92vh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto border border-border bg-background p-6 shadow-lg duration-200",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "sm:rounded-lg",
);

interface Props {
  open: boolean;
  /** Given when editing an existing branch. */
  initial?: CreditBranch;
  onClose: () => void;
  onSave: (data: CreateCreditBranchInput) => void;
  isSaving: boolean;
}

interface FormState {
  name: string;
  address: string;
  phone: string;
  evcNumber: string;
  edahabNumber: string;
  accountNumber: string;
  invoicePrefix: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

function Field({
  label,
  required,
  error,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium leading-none">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

export function CreditBranchModal({
  open,
  initial,
  onClose,
  onSave,
  isSaving,
}: Props) {
  const isEdit = Boolean(initial);
  // The API refuses to change the prefix once invoices have gone out.
  const prefixLocked = isEdit && (initial?.nextInvoiceNumber ?? 1) > 1;

  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    evcNumber: initial?.evcNumber ?? "",
    edahabNumber: initial?.edahabNumber ?? "",
    accountNumber: initial?.accountNumber ?? "",
    invoicePrefix: initial?.invoicePrefix ?? "",
  });
  const [err, setErr] = useState<Errors>({});

  const set = (key: keyof FormState, value: string) =>
    setForm((s) => ({ ...s, [key]: value }));

  const prefix = form.invoicePrefix.trim().toUpperCase();

  const save = () => {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.address.trim()) next.address = "Address is required";
    if (prefix && !/^[A-Z0-9]{2,6}$/.test(prefix)) {
      next.invoicePrefix = "Use 2 to 6 letters or numbers";
    }
    setErr(next);
    if (Object.keys(next).length) return;

    const trimmed = {
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      evcNumber: form.evcNumber.trim(),
      edahabNumber: form.edahabNumber.trim(),
      accountNumber: form.accountNumber.trim(),
    };

    if (isEdit) {
      // Editing: empty means "clear it". The prefix is sent only when it changed.
      onSave({
        ...trimmed,
        ...(!prefixLocked && prefix && prefix !== initial?.invoicePrefix
          ? { invoicePrefix: prefix }
          : undefined),
      });
      return;
    }

    // Adding: leave out anything left blank (the prefix then comes from the name).
    onSave({
      name: trimmed.name,
      address: trimmed.address,
      ...(trimmed.phone ? { phone: trimmed.phone } : undefined),
      ...(trimmed.evcNumber ? { evcNumber: trimmed.evcNumber } : undefined),
      ...(trimmed.edahabNumber
        ? { edahabNumber: trimmed.edahabNumber }
        : undefined),
      ...(trimmed.accountNumber
        ? { accountNumber: trimmed.accountNumber }
        : undefined),
      ...(prefix ? { invoicePrefix: prefix } : undefined),
    });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/80" />
        <Dialog.Content className={contentCls}>
          <div className="flex flex-col gap-1.5 text-left pr-6">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              {isEdit ? "Edit branch" : "Add credit branch"}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {isEdit
                ? "Update the branch and what its invoices show."
                : "This branch buys stock from you on credit and pays it back over time. Add a branch manager login for it afterwards from Users."}
            </Dialog.Description>
          </div>

          <div className="grid gap-4">
            <Field label="Branch name" required error={err.name}>
              <input
                className={cn(inputCls, err.name && "border-destructive")}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Hargeisa Branch"
                autoFocus
              />
            </Field>
            <Field label="Address" required error={err.address}>
              <input
                className={cn(inputCls, err.address && "border-destructive")}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Street, city"
              />
            </Field>
          </div>

          <fieldset className="grid gap-4 rounded-md border border-border p-4">
            <legend className="px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Shown on this branch&apos;s invoices
            </legend>
            <p className="-mt-1 text-xs text-muted-foreground">
              The branch is its own business, so its invoices use these details
              instead of the organization&apos;s.
            </p>
            <Field label="Phone">
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="EVC number">
                <input
                  className={inputCls}
                  value={form.evcNumber}
                  onChange={(e) => set("evcNumber", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="eDahab number">
                <input
                  className={inputCls}
                  value={form.edahabNumber}
                  onChange={(e) => set("edahabNumber", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Bank account">
                <input
                  className={inputCls}
                  value={form.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>
            <Field
              label="Invoice prefix"
              error={err.invoicePrefix}
              helper={
                prefixLocked
                  ? "Locked: this branch has already issued invoices."
                  : `Invoices read ${prefix || "HARG"}-0001, ${prefix || "HARG"}-0002… Leave blank to make one from the name.`
              }
            >
              <input
                className={cn(
                  inputCls,
                  "max-w-40 font-mono uppercase",
                  err.invoicePrefix && "border-destructive",
                )}
                value={form.invoicePrefix}
                onChange={(e) =>
                  set(
                    "invoicePrefix",
                    e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6),
                  )
                }
                disabled={prefixLocked}
                placeholder="Auto"
                maxLength={6}
              />
            </Field>
          </fieldset>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save changes" : "Add branch"}
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
