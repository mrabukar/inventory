"use client";

import { useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useCustomers } from "@/hooks/customers/use-customers";
import { useInvoices } from "@/hooks/invoices/use-invoices";
import { todayYmd } from "@/lib/filters/dates";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import type { CreatePaymentInput } from "@/types/payments/payment";

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: CreatePaymentInput) => void;
  isSaving: boolean;
  defaultCustomerId?: string;
}

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="grid gap-2">
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

export function RecordPaymentModal({
  open,
  onClose,
  onSave,
  isSaving,
  defaultCustomerId,
}: RecordPaymentModalProps) {
  const [customerId, setCustomerId] = useState<string | undefined>(
    defaultCustomerId,
  );
  const [invoiceId, setInvoiceId] = useState<string | undefined>();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayYmd());
  const [note, setNote] = useState("");
  const [err, setErr] = useState<{ customerId?: string; amount?: string }>({});

  const { data: customersData } = useCustomers({ limit: 50 });
  const customers = customersData?.data ?? [];

  const customerItems = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.phone ? `${c.name} · ${c.phone}` : c.name,
      })),
    [customers],
  );

  // Unpaid invoices for the selected customer.
  const { data: invoicesData } = useInvoices({
    customerId,
    status: "unpaid",
    limit: 50,
  });
  const { data: partialInvoicesData } = useInvoices({
    customerId,
    status: "partial",
    limit: 50,
  });
  const unpaidInvoices = useMemo(() => {
    const list = [
      ...(invoicesData?.data ?? []),
      ...(partialInvoicesData?.data ?? []),
    ];
    return list.sort((a, b) => a.number - b.number);
  }, [invoicesData?.data, partialInvoicesData?.data]);

  const invoiceItems = useMemo(
    () =>
      unpaidInvoices.map((inv) => {
        const remaining = toNumber(inv.total) - toNumber(inv.paidAmount);
        return {
          value: inv.id,
          label: `${inv.numberLabel} · ${fmt(remaining)} remaining`,
        };
      }),
    [unpaidInvoices],
  );

  // Auto-target the oldest unpaid if none picked.
  const targetInvoice =
    unpaidInvoices.find((inv) => inv.id === invoiceId) ?? unpaidInvoices[0];
  const remaining = targetInvoice
    ? toNumber(targetInvoice.total) - toNumber(targetInvoice.paidAmount)
    : 0;

  const save = () => {
    const next: typeof err = {};
    if (!customerId) next.customerId = "Customer is required";
    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      next.amount = "Enter a positive amount";
    } else if (targetInvoice && parsedAmount > remaining + 0.001) {
      next.amount = `Amount exceeds invoice remainder (${fmt(remaining)})`;
    } else if (!targetInvoice) {
      next.amount = "This customer has no unpaid invoice";
    }
    setErr(next);
    if (Object.keys(next).length || !customerId || !targetInvoice) return;

    onSave({
      customerId,
      invoiceId: invoiceId ?? targetInvoice.id,
      amount: parsedAmount,
      paidAt,
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "sm:rounded-lg",
          )}
        >
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Record payment
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Payments are applied to a specific invoice. Leave the invoice
              picker empty to apply to the customer&apos;s oldest unpaid.
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
            <Field label="Customer" required error={err.customerId}>
              <Combobox
                value={customerId}
                onValueChange={(value) => {
                  setCustomerId(value);
                  setInvoiceId(undefined);
                }}
                items={customerItems}
                placeholder="Select a customer"
                searchPlaceholder="Search customers…"
                emptyText="No customers found."
                className="w-full"
                popoverClassName="z-[200]"
              />
            </Field>

            {customerId && unpaidInvoices.length > 0 ? (
              <Field
                label="Invoice"
                helper={
                  invoiceId
                    ? undefined
                    : `Defaults to oldest unpaid (${unpaidInvoices[0]?.numberLabel ?? ""})`
                }
              >
                <Combobox
                  value={invoiceId}
                  onValueChange={setInvoiceId}
                  items={invoiceItems}
                  placeholder="Oldest unpaid (default)"
                  className="w-full"
                  popoverClassName="z-[200]"
                  clearOption={{ label: "Oldest unpaid" }}
                />
              </Field>
            ) : customerId ? (
              <p className="text-sm text-muted-foreground">
                This customer has no unpaid invoice.
              </p>
            ) : null}

            <Field
              label="Amount"
              required
              error={err.amount}
              helper={
                targetInvoice
                  ? `${targetInvoice.numberLabel} remaining: ${fmt(remaining)}`
                  : undefined
              }
            >
              <input
                className={cn(inputClassName, err.amount && "border-destructive")}
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field label="Date" required>
              <input
                className={inputClassName}
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </Field>

            <Field label="Note">
              <textarea
                className={cn(inputClassName, "min-h-[70px] resize-y py-2")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </Field>
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
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving ? "Saving…" : "Record payment"}
            </Button>
          </div>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={onClose}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
