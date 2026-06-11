"use client";

import { Dialog } from "radix-ui";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, fmt } from "@/lib/utils";

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-[70] grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "sm:rounded-lg",
);

interface Props {
  open: boolean;
  title: string;
  message: string;
  projectedNetProfit: number;
  isEdit?: boolean;
  oldAmount?: number;
  newAmount?: number;
  expenseDelta?: number;
  netProfitExcludingExpense?: number;
  currentNetProfit?: number;
  isSaving?: boolean;
  onProceed: () => void;
  onCancel: () => void;
}

export function ExpenseProfitWarningDialog({
  open,
  title,
  message,
  projectedNetProfit,
  isEdit = false,
  oldAmount = 0,
  newAmount,
  expenseDelta = 0,
  netProfitExcludingExpense,
  currentNetProfit,
  isSaving = false,
  onProceed,
  onCancel,
}: Props) {
  const handleOpen = (nextOpen: boolean) => {
    if (!nextOpen) onCancel();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/80" />
        <Dialog.Content className={dialogContentClassName}>
          <div className="flex gap-3 text-left">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full"
              style={{
                background: "var(--status-rose-soft, rgba(244, 63, 94, 0.12))",
              }}
            >
              <AlertTriangle
                className="size-5"
                style={{ color: "var(--status-rose)" }}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground leading-relaxed">
                {message}
              </Dialog.Description>
              {isEdit && newAmount != null ? (
                <div className="mt-1 space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <p>
                    Expense: {fmt(oldAmount)} → {fmt(newAmount)}
                    <span className="text-muted-foreground">
                      {" "}
                      ({expenseDelta >= 0 ? "+" : ""}
                      {fmt(expenseDelta)})
                    </span>
                  </p>
                  {netProfitExcludingExpense != null &&
                  currentNetProfit != null ? (
                    <p className="text-muted-foreground">
                      Net profit without this expense:{" "}
                      {fmt(netProfitExcludingExpense)} → after change:{" "}
                      <span
                        style={{
                          color:
                            projectedNetProfit < 0
                              ? "var(--status-rose)"
                              : undefined,
                        }}
                      >
                        {fmt(projectedNetProfit)}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm font-medium">
                  Projected net profit:{" "}
                  <span
                    style={{
                      color:
                        projectedNetProfit < 0
                          ? "var(--status-rose)"
                          : undefined,
                    }}
                  >
                    {fmt(projectedNetProfit)}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onProceed}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Proceed anyway"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
