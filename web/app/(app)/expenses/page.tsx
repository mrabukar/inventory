"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { ExpenseCategoryListModal } from "./components/expense-category-list-modal";
import { ExpenseProfitWarningDialog } from "./components/expense-profit-warning-dialog";
import {
  ExpenseModal,
  type ExpenseFormValues,
} from "./components/expense-modal";
import { ExpensesTable } from "./components/expenses-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useCreateExpenseCategory } from "@/hooks/expense-categories/use-create-expense-category";
import { useDeleteExpenseCategory } from "@/hooks/expense-categories/use-delete-expense-category";
import { useExpenseCategories } from "@/hooks/expense-categories/use-expense-categories";
import { useUpdateExpenseCategory } from "@/hooks/expense-categories/use-update-expense-category";
import { useCreateExpense } from "@/hooks/expenses/use-create-expense";
import { useDeleteExpense } from "@/hooks/expenses/use-delete-expense";
import { useExpenses } from "@/hooks/expenses/use-expenses";
import { useUpdateExpense } from "@/hooks/expenses/use-update-expense";
import { useStores } from "@/hooks/stores/list-stores";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  buildProfitWarningMessage,
  formatProfitPeriodLabel,
  getProfitCheckPeriod,
  isExpenseInPeriod,
  shouldWarnExpenseProfit,
} from "@/lib/expenses/profit-warning";
import { getCurrentMonthRange } from "@/lib/filters/dates";
import { listExpenses } from "@/service/expenses/list-expenses";
import { getFinancialSummary } from "@/service/reports/financial-summary";
import { useAppStore } from "@/store/app";
import { expenseAmount, type Expense } from "@/types/expenses/expense";

type ModalState = { mode: "add" } | { mode: "edit"; expense: Expense };

interface ProfitWarningState {
  form: ExpenseFormValues;
  title: string;
  message: string;
  projectedNetProfit: number;
  currentNetProfit: number;
  isEdit: boolean;
  oldAmount: number;
  newAmount: number;
  expenseDelta: number;
  netProfitExcludingExpense: number;
}

export default function ExpensesPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const defaultRange = useMemo(() => getCurrentMonthRange(), []);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [storeId, setStoreId] = useState<string | undefined>();
  const [companyWideOnly, setCompanyWideOnly] = useState(false);
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [profitWarning, setProfitWarning] = useState<ProfitWarningState | null>(
    null,
  );
  const [isCheckingProfit, setIsCheckingProfit] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      categoryId,
      storeId: companyWideOnly ? undefined : storeId || undefined,
      companyWideOnly: companyWideOnly || undefined,
      fromDate,
      toDate,
    }),
    [
      pageIndex,
      pageSize,
      debouncedSearch,
      categoryId,
      storeId,
      companyWideOnly,
      fromDate,
      toDate,
    ],
  );

  const { data: storesData } = useStores({ limit: 100 });
  const { data: categoriesData, isPending: categoriesPending } =
    useExpenseCategories();
  const { data, isPending, isFetching, isError, error } =
    useExpenses(listQuery);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading =
    isPending || (isFetching && (data?.data.length ?? 0) === 0);
  const categories = categoriesData ?? [];

  const storeItems = useMemo(
    () =>
      (storesData?.data ?? []).map((store) => ({
        value: store.id,
        label: store.name,
      })),
    [storesData],
  );

  const categoryFilterItems = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [categories],
  );

  const resetPage = () => setPageIndex(0);

  const handleExportAll = useCallback(async () => {
    const limit = 100;
    let page = 1;
    const exported: Expense[] = [];
    let totalPages = 1;

    do {
      const response = await listExpenses({ ...listQuery, page, limit });
      exported.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return exported;
  }, [listQuery]);

  const persistExpense = async (form: ExpenseFormValues) => {
    if (form.categoryId == null) return;

    const base = {
      title: form.title.trim(),
      amount: Number(form.amount),
      categoryId: form.categoryId,
      expenseDate: form.expenseDate,
      note: form.note.trim() || undefined,
    };

    if (modal?.mode === "edit") {
      await updateExpense.mutateAsync({
        id: modal.expense.id,
        input: {
          ...base,
          storeId: form.storeId || null,
        },
      });
      addToast({ title: "Expense updated" });
    } else {
      await createExpense.mutateAsync({
        ...base,
        ...(form.storeId ? { storeId: form.storeId } : {}),
      });
      addToast({ title: "Expense added successfully" });
    }
    setModal(null);
    setProfitWarning(null);
  };

  const handleSaveExpense = async (form: ExpenseFormValues) => {
    if (form.categoryId == null) return;

    const amount = Number(form.amount);
    const isEdit = modal?.mode === "edit";
    const period = getProfitCheckPeriod();
    const expenseStoreLabel = storeItems.find(
      (s) => s.value === form.storeId,
    )?.label;
    const scopeLabel = expenseStoreLabel
      ? `company-wide net profit (expense for ${expenseStoreLabel})`
      : "company-wide";
    const periodLabel = formatProfitPeriodLabel(period);

    setIsCheckingProfit(true);
    try {
      // Always use company-wide net profit — matches the dashboard headline.
      // Store-scoped profit excludes company-wide costs (e.g. rent) and can
      // look healthy while company-wide net profit is negative.
      const summary = await getFinancialSummary({
        fromDate: period.fromDate,
        toDate: period.toDate,
      });
      const currentNetProfit = summary.summary.netProfit;

      const oldAmount =
        isEdit &&
        modal.expense &&
        isExpenseInPeriod(modal.expense.expenseDate, period)
          ? expenseAmount(modal.expense)
          : 0;

      if (
        shouldWarnExpenseProfit({
          currentNetProfit,
          amount,
          oldAmount,
          isEdit,
        })
      ) {
        const warning = buildProfitWarningMessage({
          currentNetProfit,
          amount,
          oldAmount,
          isEdit,
          periodLabel,
          scopeLabel,
        });
        setProfitWarning({
          form,
          currentNetProfit,
          ...warning,
        });
        return;
      }

      await persistExpense(form);
    } catch (e) {
      addErrorToast({
        title: "Failed to save expense",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setIsCheckingProfit(false);
    }
  };

  const handleProceedDespiteWarning = async () => {
    if (!profitWarning) return;
    try {
      await persistExpense(profitWarning.form);
    } catch (e) {
      addErrorToast({
        title: "Failed to save expense",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpense.mutateAsync(deleteTarget.id);
      addToast({ title: "Expense deleted" });
      setDeleteTarget(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to delete expense",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleCreateCategory = async (input: {
    name: string;
    description?: string;
  }) => {
    try {
      const created = await createCategory.mutateAsync(input);
      addToast({ title: "Category added" });
      return created;
    } catch (e) {
      addErrorToast({
        title: "Failed to add category",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
      return undefined;
    }
  };

  const handleUpdateCategory = async (
    id: number,
    input: { name: string; description: string },
  ) => {
    try {
      await updateCategory.mutateAsync({
        id,
        input: {
          name: input.name,
          description: input.description || undefined,
        },
      });
      addToast({ title: "Category updated" });
    } catch (e) {
      addErrorToast({
        title: "Failed to update category",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
      throw e;
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCategory.mutateAsync(id);
      addToast({ title: "Category deleted" });
    } catch (e) {
      addErrorToast({
        title: "Failed to delete category",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
      throw e;
    }
  };

  const isSaving = createExpense.isPending || updateExpense.isPending;

  const toolbarExtra = (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePicker
        fromDate={fromDate}
        toDate={toDate}
        onChange={(range) => {
          setFromDate(range.fromDate);
          setToDate(range.toDate);
          resetPage();
        }}
      />
      <Combobox
        value={categoryId != null ? String(categoryId) : undefined}
        onValueChange={(value) => {
          setCategoryId(value ? Number(value) : undefined);
          resetPage();
        }}
        items={categoryFilterItems}
        clearOption={{ label: "All categories" }}
        placeholder="All categories"
        searchPlaceholder="Search categories…"
        emptyText="No categories found."
        loading={categoriesPending}
      />
      <Combobox
        value={storeId}
        onValueChange={(value) => {
          setStoreId(value);
          resetPage();
        }}
        items={storeItems}
        clearOption={{ label: "All stores" }}
        placeholder="All stores"
        searchPlaceholder="Search stores…"
        emptyText="No stores found."
        disabled={companyWideOnly}
      />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={companyWideOnly}
          onCheckedChange={(checked) => {
            const next = checked === true;
            setCompanyWideOnly(next);
            if (next) setStoreId(undefined);
            resetPage();
          }}
        />
        Company-wide only
      </label>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Expenses"
        desc="Operating costs, company-wide and per store"
        action={
          <Button onClick={() => setModal({ mode: "add" })}>
            <Plus className="size-4" />
            Add Expense
          </Button>
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load expenses."}
        </div>
      )}

      <ExpensesTable
        rows={rows}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        onPaginationChange={({ pageIndex: nextIndex, pageSize: nextSize }) => {
          setPageIndex(nextIndex);
          setPageSize(nextSize);
        }}
        isLoading={isLoading}
        onExportAll={handleExportAll}
        onEdit={(expense) => setModal({ mode: "edit", expense })}
        onDelete={setDeleteTarget}
        toolbarExtra={toolbarExtra}
      />

      {modal && (
        <ExpenseModal
          key={`${modal.mode}-${modal.mode === "edit" ? modal.expense.id : "new"}`}
          open
          mode={modal.mode}
          expense={modal.mode === "edit" ? modal.expense : undefined}
          categories={categories}
          categoriesLoading={categoriesPending}
          storeItems={storeItems}
          onClose={() => setModal(null)}
          onSave={(form) => void handleSaveExpense(form)}
          isSaving={isSaving}
          isCheckingProfit={isCheckingProfit}
          onSeeAllCategories={() => setShowCategoryList(true)}
          onCreateCategory={handleCreateCategory}
          isCreatingCategory={createCategory.isPending}
        />
      )}

      <ExpenseCategoryListModal
        open={showCategoryList}
        categories={categories}
        isLoading={categoriesPending}
        onClose={() => setShowCategoryList(false)}
        onCreate={handleCreateCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
        isCreating={createCategory.isPending}
        isSaving={updateCategory.isPending}
        isDeleting={deleteCategory.isPending}
      />

      <ExpenseProfitWarningDialog
        open={profitWarning != null}
        title={profitWarning?.title ?? ""}
        message={profitWarning?.message ?? ""}
        projectedNetProfit={profitWarning?.projectedNetProfit ?? 0}
        currentNetProfit={profitWarning?.currentNetProfit}
        isEdit={profitWarning?.isEdit}
        oldAmount={profitWarning?.oldAmount}
        newAmount={profitWarning?.newAmount}
        expenseDelta={profitWarning?.expenseDelta}
        netProfitExcludingExpense={profitWarning?.netProfitExcludingExpense}
        isSaving={isSaving}
        onProceed={() => void handleProceedDespiteWarning()}
        onCancel={() => setProfitWarning(null)}
      />

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete expense?"
          message="This expense will be permanently deleted. This action cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteExpense.isPending}
          onConfirm={() => void handleDeleteExpense()}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </>
  );
}
