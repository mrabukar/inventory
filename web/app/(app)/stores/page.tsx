"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, PowerOff } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStores } from "@/hooks/stores/list-stores";
import { useCreateStore } from "@/hooks/stores/use-create-store";
import { useUpdateStore } from "@/hooks/stores/use-update-store";
import { useDeactivateStore } from "@/hooks/stores/use-deactivate-store";
import { listStores } from "@/service/stores/list-stores";
import { useAppStore } from "@/store/app";
import type { Store } from "@/types/stores/store";

import { StoreModal, type StoreFormValues } from "./components/store-modal";

interface SheetState {
  mode: "add" | "edit";
  row?: Store;
}

export default function StoresPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [confirm, setConfirm] = useState<Store | null>(null);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
    }),
    [pageIndex, pageSize, debouncedSearch],
  );

  const { data, isPending, isFetching, isError, error } = useStores(listQuery);
  const isLoading = isPending || (isFetching && (data?.data.length ?? 0) === 0);
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const deactivateStore = useDeactivateStore();

  const stores = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;

  const columns = useMemo<ColumnDef<Store>[]>(
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
        accessorKey: "address",
        meta: { label: "Address", align: "center" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Address" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.address}</span>
        ),
      },
      {
        accessorKey: "isActive",
        meta: {
          label: "Status",
          align: "center",
          exportValue: (row: Store) => (row.isActive ? "Active" : "Inactive"),
        },
        header: "Status",
        cell: ({ row }) => <StatusBadge active={row.original.isActive} />,
        enableSorting: false,
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
              title="Deactivate"
              onClick={() => setConfirm(row.original)}
            >
              <PowerOff size={16} />
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [],
  );

  const handleExportAll = useCallback(async () => {
    const limit = 100;
    let page = 1;
    const rows: Store[] = [];
    let totalPages = 1;

    do {
      const response = await listStores({
        page,
        limit,
        search: debouncedSearch || undefined,
      });
      rows.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return rows;
  }, [debouncedSearch]);

  const saveStore = async (form: StoreFormValues) => {
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
    };

    try {
      if (sheet?.row) {
        await updateStore.mutateAsync({ id: sheet.row.id, input: payload });
        addToast({ title: "Store updated" });
      } else {
        await createStore.mutateAsync(payload);
        addToast({ title: "Store added successfully" });
      }
      setSheet(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to save store",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleDeactivate = async () => {
    if (!confirm) return;
    try {
      await deactivateStore.mutateAsync(confirm.id);
      addToast({ title: "Store deactivated" });
      setConfirm(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to deactivate store",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const isSaving = createStore.isPending || updateStore.isPending;

  return (
    <>
      <PageHeader
        title="Stores"
        desc="Manage your store locations"
        action={
          <Button onClick={() => setSheet({ mode: "add" })}>
            <Plus className="size-4" />
            Add Store
          </Button>
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load stores."}
        </div>
      )}

      <DataTable
        columns={columns}
        data={stores}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
          setPageIndex(nextPage);
          setPageSize(nextSize);
        }}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPageIndex(0);
        }}
        searchPlaceholder="Search stores…"
        isLoading={isLoading}
        exportFileName="stores"
        onExportAll={handleExportAll}
        getRowId={(row) => row.id}
        emptyTitle="No stores found"
        emptyDescription="Try adjusting your search or add a new store."
      />

      <StoreModal
        open={sheet !== null}
        initial={sheet?.row}
        onClose={() => setSheet(null)}
        onSave={(form) => void saveStore(form)}
        isSaving={isSaving}
      />

      {confirm && (
        <ConfirmDialog
          title="Deactivate store?"
          message="This store will be hidden from forms. Deactivation will fail if managers are still assigned or stock remains."
          confirmLabel="Deactivate"
          variant="danger"
          isLoading={deactivateStore.isPending}
          onConfirm={() => void handleDeactivate()}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
