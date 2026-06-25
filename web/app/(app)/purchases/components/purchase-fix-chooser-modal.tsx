"use client";

import { Dialog } from "radix-ui";
import { MinusCircle, PlusCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, fmt } from "@/lib/utils";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import { purchaseReversibleQuantity } from "@/lib/purchases/reversible-quantity";
import type { Purchase } from "@/types/purchases/purchase";

export type PurchaseFixMode = "add" | "subtract";

interface PurchaseFixChooserModalProps {
  open: boolean;
  purchase?: Purchase | null;
  onClose: () => void;
  onSelect: (mode: PurchaseFixMode) => void;
}

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
  "sm:rounded-lg",
);

function OptionCard({
  icon: Icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

export function PurchaseFixChooserModal({
  open,
  purchase,
  onClose,
  onSelect,
}: PurchaseFixChooserModalProps) {
  const removable = purchase ? purchaseReversibleQuantity(purchase) : 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className={dialogContentClassName}>
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Fix a purchase mistake
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Use this only when a past purchase was recorded with the wrong
              quantity. This does not replace recording a new purchase.
            </Dialog.Description>
          </div>

          {purchase ? (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              <span className="font-medium">Fixing: </span>
              <span>
                {formatProductLabel(
                  purchase.product.name,
                  purchase.product.model,
                )}
              </span>
              <div className="mt-1 text-muted-foreground">
                Recorded {purchase.quantity} unit
                {purchase.quantity === 1 ? "" : "s"} @{" "}
                {fmt(toNumber(purchase.unitPurchasePrice))}
                {purchase.invoiceNumber ? ` · ${purchase.invoiceNumber}` : ""}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3">
            <OptionCard
              icon={PlusCircle}
              title="Add missing units"
              description="You bought more than was recorded on this purchase."
              onClick={() => onSelect("add")}
            />
            <OptionCard
              icon={MinusCircle}
              title="Remove extra units"
              description={
                removable > 0
                  ? "You recorded too many units by mistake."
                  : "Nothing left to remove on this purchase after prior corrections."
              }
              disabled={removable <= 0}
              onClick={() => onSelect("subtract")}
            />
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
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
