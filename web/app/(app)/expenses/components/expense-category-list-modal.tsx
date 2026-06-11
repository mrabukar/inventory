"use client";

import { useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { Plus, X } from "lucide-react";

import { ExpenseCategoriesTable } from "./expense-categories-table";
import { ExpenseCategoryCreateModal } from "./expense-category-create-modal";
import { ExpenseCategoryDeleteDialog } from "./expense-category-delete-dialog";
import { ExpenseCategoryEditModal } from "./expense-category-edit-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/types/expenses/expense-category";

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-50 grid w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "sm:rounded-lg",
);

interface Props {
  open: boolean;
  categories: ExpenseCategory[];
  isLoading?: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description?: string;
  }) => Promise<ExpenseCategory | void>;
  onUpdate: (
    id: number,
    data: { name: string; description: string },
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isCreating?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
}

export function ExpenseCategoryListModal({
  open,
  categories,
  isLoading = false,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  isCreating = false,
  isSaving = false,
  isDeleting = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(
    null,
  );

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false),
    );
  }, [categories, search]);

  const handleEditSave = async (data: { name: string; description: string }) => {
    if (!editTarget) return;
    await onUpdate(editTarget.id, data);
    setEditTarget(null);
  };

  const handleCreateSave = async (data: {
    name: string;
    description: string;
  }) => {
    const created = await onCreate({
      name: data.name,
      description: data.description || undefined,
    });
    if (created) setShowCreate(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Error toast handled by parent
    }
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
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <Dialog.Content className={dialogContentClassName}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5 text-left">
                <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
                  Expense Categories
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Manage categories used when recording expenses.
                </Dialog.Description>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="size-4" />
                Add Category
              </Button>
            </div>

            <ExpenseCategoriesTable
              rows={filteredCategories}
              searchValue={search}
              onSearchChange={setSearch}
              isLoading={isLoading}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
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

      {showCreate && (
        <ExpenseCategoryCreateModal
          open
          onClose={() => setShowCreate(false)}
          onSave={(data) => void handleCreateSave(data)}
          isSaving={isCreating}
        />
      )}

      <ExpenseCategoryEditModal
        open={editTarget != null}
        category={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEditSave}
        isSaving={isSaving}
      />

      <ExpenseCategoryDeleteDialog
        open={deleteTarget != null}
        categoryName={deleteTarget?.name ?? ""}
        isDeleting={isDeleting}
        onConfirm={() => void handleDeleteConfirm()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
