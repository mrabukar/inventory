"use client";

import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-[70] grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "sm:rounded-lg",
);

interface Props {
  open: boolean;
  categoryName: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ExpenseCategoryDeleteDialog({
  open,
  categoryName,
  isDeleting = false,
  onConfirm,
  onClose,
}: Props) {
  const handleOpen = (nextOpen: boolean) => {
    if (!nextOpen) onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/80" />
        <Dialog.Content className={dialogContentClassName}>
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Delete category?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Delete &ldquo;{categoryName}&rdquo;? This cannot be undone.
              Categories in use by expenses cannot be deleted.
            </Dialog.Description>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
