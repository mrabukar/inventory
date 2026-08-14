"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { CustomerModal } from "./components/customer-modal";
import { CustomerTable } from "./components/customer-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/hooks/customers/use-customers";
import {
  useCreateCustomer,
  useUpdateCustomer,
} from "@/hooks/customers/use-mutate-customer";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAppStore } from "@/store/app";
import type {
  CreateCustomerInput,
  Customer,
} from "@/types/customers/customer";

export default function CustomersPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
    }),
    [pageIndex, pageSize, debouncedSearch],
  );

  const { data, isPending, isFetching, isError, error } =
    useCustomers(listQuery);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading = isPending || (isFetching && (data?.data.length ?? 0) === 0);

  const resetPage = () => setPageIndex(0);

  const modalOpen = showCreate || editTarget !== null;
  const closeModal = () => {
    setShowCreate(false);
    setEditTarget(null);
  };

  const handleSave = async (input: CreateCustomerInput) => {
    try {
      if (editTarget) {
        await updateCustomer.mutateAsync({ id: editTarget.id, input });
        addToast({ title: "Customer updated" });
      } else {
        await createCustomer.mutateAsync(input);
        addToast({ title: "Customer added" });
      }
      closeModal();
    } catch (e) {
      addErrorToast({
        title: editTarget
          ? "Failed to update customer"
          : "Failed to add customer",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Customers"
        desc="Manage customers used for sales, invoices, and balances"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Add Customer
          </Button>
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load customers."}
        </div>
      )}

      <CustomerTable
        rows={rows}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
          setPageIndex(nextPage);
          setPageSize(nextSize);
        }}
        isLoading={isLoading}
        onEdit={setEditTarget}
      />

      <CustomerModal
        key={editTarget?.id ?? (showCreate ? "create" : "closed")}
        open={modalOpen}
        customer={editTarget}
        onClose={closeModal}
        onSave={(form) => void handleSave(form)}
        isSaving={createCustomer.isPending || updateCustomer.isPending}
      />
    </>
  );
}
