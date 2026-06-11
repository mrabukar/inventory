"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/types/expenses/expense-category";

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-[60] grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "sm:rounded-lg",
);

interface Props {
  open: boolean;
  category: ExpenseCategory | null;
  onClose: () => void;
  onSave: (data: { name: string; description: string }) => void;
  isSaving: boolean;
}

export function ExpenseCategoryEditModal({
  open,
  category,
  onClose,
  onSave,
  isSaving,
}: Props) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [err, setErr] = useState<{ name?: string }>({});

  useEffect(() => {
    if (open && category) {
      setName(category.name);
      setDescription(category.description ?? "");
      setErr({});
    }
  }, [open, category]);

  const handleOpen = (nextOpen: boolean) => {
    if (!nextOpen) onClose();
  };

  const save = () => {
    if (!name.trim()) {
      setErr({ name: "Name is required" });
      return;
    }
    onSave({ name: name.trim(), description: description.trim() });
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/80" />
        <Dialog.Content className={dialogContentClassName}>
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Edit Category
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Update the expense category name or description.
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                className={cn(inputClassName, err.name && "border-destructive")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErr({});
                }}
                placeholder="Category name"
                maxLength={100}
              />
              {err.name ? (
                <p className="text-sm text-destructive">{err.name}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">
                Description
              </label>
              <textarea
                className={cn(inputClassName, "min-h-[80px] resize-y py-2")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
              />
            </div>
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
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
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
