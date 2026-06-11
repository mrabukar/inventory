"use client";

import { useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { ExpenseCategoryCreateModal } from "./expense-category-create-modal";
import { ExpenseCategoryPicker } from "./expense-category-picker";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { dateToYmd } from "@/lib/filters/dates";
import { cn } from "@/lib/utils";
import type { Expense } from "@/types/expenses/expense";
import type { ExpenseCategory } from "@/types/expenses/expense-category";

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
  "sm:rounded-lg",
);

export interface ExpenseFormValues {
  title: string;
  amount: string;
  categoryId: number | undefined;
  storeId: string | undefined;
  expenseDate: string;
  note: string;
}

interface Props {
  open: boolean;
  mode: "add" | "edit";
  expense?: Expense;
  categories: ExpenseCategory[];
  categoriesLoading?: boolean;
  storeItems: { value: string; label: string }[];
  onClose: () => void;
  onSave: (data: ExpenseFormValues) => void;
  isSaving: boolean;
  isCheckingProfit?: boolean;
  onSeeAllCategories: () => void;
  onCreateCategory: (data: {
    name: string;
    description?: string;
  }) => Promise<ExpenseCategory | void>;
  isCreatingCategory?: boolean;
}

async function tryCreateCategory(
  onCreateCategory: Props["onCreateCategory"],
  data: { name: string; description: string },
  onCreated: (category: ExpenseCategory) => void,
) {
  const created = await onCreateCategory({
    name: data.name,
    description: data.description || undefined,
  });
  if (created) onCreated(created);
}

function initialForm(expense?: Expense): ExpenseFormValues {
  return {
    title: expense?.title ?? "",
    amount: expense ? String(expense.amount) : "",
    categoryId: expense?.categoryId,
    storeId: expense?.storeId ?? undefined,
    expenseDate: expense?.expenseDate.slice(0, 10) ?? dateToYmd(new Date()),
    note: expense?.note ?? "",
  };
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium leading-none">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function ExpenseModal({
  open,
  mode,
  expense,
  categories,
  categoriesLoading = false,
  storeItems,
  onClose,
  onSave,
  isSaving,
  isCheckingProfit = false,
  onSeeAllCategories,
  onCreateCategory,
  isCreatingCategory = false,
}: Props) {
  const isEdit = mode === "edit";
  const today = useMemo(() => dateToYmd(new Date()), []);
  const [form, setForm] = useState<ExpenseFormValues>(() => initialForm(expense));
  const [err, setErr] = useState<Partial<Record<keyof ExpenseFormValues, string>>>(
    {},
  );
  const [showCreateCategory, setShowCreateCategory] = useState(false);

  const set = (key: keyof ExpenseFormValues, value: string | number | undefined) =>
    setForm((state) => ({ ...state, [key]: value }));

  const save = () => {
    const next: Partial<Record<keyof ExpenseFormValues, string>> = {};

    if (!form.title.trim()) next.title = "Title is required";
    if (!form.amount || Number(form.amount) <= 0)
      next.amount = "Enter a positive amount";
    if (form.categoryId == null) next.categoryId = "Category is required";
    if (!form.expenseDate) next.expenseDate = "Date is required";
    else if (form.expenseDate > today)
      next.expenseDate = "Expense date cannot be in the future";

    setErr(next);
    if (Object.keys(next).length) return;

    onSave(form);
  };

  return (
    <>
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
              {isEdit ? "Edit Expense" : "Add Expense"}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {isEdit
                ? "Update operating cost details."
                : "Record a company-wide or store-specific expense."}
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
            <FormField label="Title" required error={err.title}>
              <input
                className={cn(inputClassName, err.title && "border-destructive")}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. June Electricity Bill"
                maxLength={200}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Amount" required error={err.amount}>
                <input
                  className={cn(
                    inputClassName,
                    err.amount && "border-destructive",
                  )}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Category" required error={err.categoryId}>
                <ExpenseCategoryPicker
                  value={form.categoryId}
                  onValueChange={(id) => set("categoryId", id)}
                  categories={categories}
                  loading={categoriesLoading}
                  error={!!err.categoryId}
                  onSeeAll={onSeeAllCategories}
                  onAddNew={() => setShowCreateCategory(true)}
                />
              </FormField>
            </div>

            <FormField label="Store">
              <Combobox
                value={form.storeId}
                onValueChange={(value) => set("storeId", value)}
                items={storeItems}
                clearOption={{ label: "Company-wide" }}
                placeholder="Company-wide"
                searchPlaceholder="Search stores…"
                emptyText="No stores found."
                className="w-full"
                popoverClassName="z-[200]"
              />
            </FormField>

            <FormField label="Expense date" required error={err.expenseDate}>
              <input
                className={cn(
                  inputClassName,
                  err.expenseDate && "border-destructive",
                )}
                type="date"
                max={today}
                value={form.expenseDate}
                onChange={(e) => set("expenseDate", e.target.value)}
              />
            </FormField>

            <FormField label="Notes">
              <textarea
                className={cn(inputClassName, "min-h-[80px] resize-y py-2")}
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Optional notes"
                maxLength={500}
              />
            </FormField>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isCheckingProfit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={isSaving || isCheckingProfit}
            >
              {isCheckingProfit
                ? "Checking…"
                : isSaving
                  ? "Saving…"
                  : isEdit
                    ? "Save Changes"
                    : "Add Expense"}
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

    {showCreateCategory && (
      <ExpenseCategoryCreateModal
        open
        onClose={() => setShowCreateCategory(false)}
        onSave={(data) =>
          void tryCreateCategory(onCreateCategory, data, (created) => {
            set("categoryId", created.id);
            setShowCreateCategory(false);
          })
        }
        isSaving={isCreatingCategory ?? false}
      />
    )}
    </>
  );
}
