"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CreateCreditBranchInput } from "@/types/credit-branches/credit-branch";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const contentCls = cn(
  "fixed left-1/2 top-1/2 z-[60] grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "sm:rounded-lg",
);

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateCreditBranchInput) => void;
  isSaving: boolean;
}

export function CreditBranchModal({ open, onClose, onSave, isSaving }: Props) {
  const [form, setForm] = useState<CreateCreditBranchInput>({ name: "", address: "" });
  const [err, setErr] = useState<Partial<CreateCreditBranchInput>>({});

  const set = (key: keyof CreateCreditBranchInput, value: string) =>
    setForm((s) => ({ ...s, [key]: value }));

  const save = () => {
    const next: Partial<CreateCreditBranchInput> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.address.trim()) next.address = "Address is required";
    setErr(next);
    if (Object.keys(next).length) return;
    onSave(form);
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
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Add credit branch
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              This branch buys stock from you on credit and pays it back over
              time. Add a branch manager login for it afterwards from Users.
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">
                Branch name <span className="text-destructive">*</span>
              </label>
              <input
                className={cn(inputCls, err.name && "border-destructive")}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Hargeisa Branch"
                autoFocus
              />
              {err.name ? <p className="text-sm text-destructive">{err.name}</p> : null}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">
                Address <span className="text-destructive">*</span>
              </label>
              <input
                className={cn(inputCls, err.address && "border-destructive")}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Street, city"
              />
              {err.address ? (
                <p className="text-sm text-destructive">{err.address}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving ? "Adding…" : "Add branch"}
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
