"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCategories } from "@/hooks/categories/use-categories";
import { useCreateCategory } from "@/hooks/categories/use-create-category";
import { useUpdateCategory } from "@/hooks/categories/use-update-category";
import { useDeleteCategory } from "@/hooks/categories/use-delete-category";
import { useAppStore } from "@/store/app";
import type { Category } from "@/types/categories/category";

import {
  CategoryModal,
  type CategoryFormValues,
} from "./components/category-modal";

interface SheetState {
  mode: "add" | "edit";
  row?: Category;
}

export default function CategoriesPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [confirm, setConfirm] = useState<Category | null>(null);

  const { data: allCategories = [], isPending, isError, error } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const categories = useMemo(() => {
    if (!debouncedSearch) return allCategories;
    const q = debouncedSearch.toLowerCase();
    return allCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCategories, debouncedSearch]);

  const columns = useMemo<ColumnDef<Category>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: "Name", align: "center" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => <span className="strong">{row.original.name}</span>,
      },
      {
        accessorKey: "description",
        meta: { label: "Description", align: "center" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.description ?? "—"}</span>
        ),
        enableSorting: false,
      },
      {
        id: "products",
        accessorFn: (row) => row._count?.products ?? 0,
        meta: { label: "Products", align: "center" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Products" />
        ),
        cell: ({ row }) => (
          <span className="num muted">{row.original._count?.products ?? 0}</span>
        ),
      },
      {
        id: "actions",
        meta: { export: false, align: "center" },
        header: "Actions",
        cell: ({ row }) => (
          <div className="dt-actions">
            <button
              type="button"
              className="dt-act"
              title="Edit"
              onClick={() => setSheet({ mode: "edit", row: row.original })}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="dt-act danger"
              title="Delete"
              onClick={() => setConfirm(row.original)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [],
  );

  const saveCategory = async (form: CategoryFormValues) => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
    };

    try {
      if (sheet?.row) {
        await updateCategory.mutateAsync({ id: sheet.row.id, input: payload });
        addToast({ title: "Category updated" });
      } else {
        await createCategory.mutateAsync(payload);
        addToast({ title: "Category added successfully" });
      }
      setSheet(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to save category",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await deleteCategory.mutateAsync(confirm.id);
      addToast({ title: "Category deleted" });
      setConfirm(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to delete category",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const isSaving = createCategory.isPending || updateCategory.isPending;

  return (
    <>
      <PageHeader
        title="Categories"
        desc="Manage product categories"
        action={
          <Button onClick={() => setSheet({ mode: "add" })}>
            <Plus className="size-4" />
            Add Category
          </Button>
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load categories."}
        </div>
      )}

      <DataTable
        columns={columns}
        data={categories}
        rowCount={categories.length}
        pageIndex={0}
        pageSize={categories.length || 20}
        onPaginationChange={() => undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search categories…"
        isLoading={isPending}
        exportFileName="categories"
        getRowId={(row) => String(row.id)}
        emptyTitle="No categories found"
        emptyDescription="Try adjusting your search or add a new category."
      />

      <CategoryModal
        open={sheet !== null}
        initial={sheet?.row}
        onClose={() => setSheet(null)}
        onSave={(form) => void saveCategory(form)}
        isSaving={isSaving}
      />

      {confirm && (
        <ConfirmDialog
          title="Delete category?"
          message={`"${confirm.name}" will be permanently deleted. This will fail if any products are assigned to it.`}
          confirmLabel="Delete"
          variant="danger"
          isLoading={deleteCategory.isPending}
          onConfirm={() => void handleDelete()}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
