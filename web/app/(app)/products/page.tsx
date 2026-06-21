"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, PowerOff } from "lucide-react";
// import { Receipt } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { useCategories } from "@/hooks/categories/use-categories";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCreateProduct } from "@/hooks/products/use-create-product";
import { useDeactivateProduct } from "@/hooks/products/use-deactivate-product";
import { useProducts } from "@/hooks/products/use-products";
// import { useSetOpeningCost } from "@/hooks/products/use-set-opening-cost";
import { useUpdateProduct } from "@/hooks/products/use-update-product";
// import type { SetOpeningCostInput } from "@/service/products/set-opening-cost";
import { listProducts } from "@/service/products/list-products";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { Product } from "@/types/products/product";

import {
  ProductSheet,
  type ProductFormValues,
} from "./components/product-sheet";
// import { OpeningCostModal } from "./components/opening-cost-modal";

interface SheetState {
  mode: "add" | "edit";
  row?: Product;
}

// function productMargin(product: Product): number {
//   const purchase = toNumber(product.purchasePrice);
//   const selling = toNumber(product.sellingPrice);
//   if (purchase <= 0) return 0;
//   return Math.round(((selling - purchase) / purchase) * 100);
// }

export default function ProductsPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  // const [missingOpeningCostOnly, setMissingOpeningCostOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [confirm, setConfirm] = useState<Product | null>(null);
  // const [openingCostProduct, setOpeningCostProduct] = useState<Product | null>(
  //   null,
  // );

  const { data: categories = [] } = useCategories();
  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      // missingOpeningCost: missingOpeningCostOnly || undefined,
    }),
    [pageIndex, pageSize, debouncedSearch, categoryId],
  );

  const { data, isPending, isFetching, isError, error } = useProducts(listQuery);
  // const { data: needsCostSummary } = useProducts({
  //   page: 1,
  //   limit: 1,
  //   missingOpeningCost: true,
  // });
  // const needsOpeningCostCount = needsCostSummary?.meta.total ?? 0;
  const isLoading =
    isPending || (isFetching && (data?.data.length ?? 0) === 0);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deactivateProduct = useDeactivateProduct();
  // const setOpeningCost = useSetOpeningCost();

  const products = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;

  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [categories],
  );

  const columns = useMemo<ColumnDef<Product>[]>(
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
        accessorKey: "model",
        meta: { label: "Model", align: "center" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.model ?? "—"}</span>
        ),
      },
      {
        id: "category",
        accessorFn: (row) => row.category.name,
        meta: {
          label: "Category",
          align: "center",
          exportValue: (row: Product) => row.category.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Category" />
        ),
        cell: ({ row }) => <CategoryBadge cat={row.original.category.name} />,
      },
      {
        id: "averageCost",
        accessorFn: (row) => toNumber(row.averageCost),
        meta: {
          label: "Avg cost",
          align: "center",
          exportValue: (row: Product) => toNumber(row.averageCost),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Avg cost" />
        ),
        cell: ({ row }) => (
          <span className="num muted">
            {fmt(toNumber(row.original.averageCost))}
          </span>
        ),
      },
      {
        id: "sellingPrice",
        accessorFn: (row) => toNumber(row.sellingPrice),
        meta: {
          label: "Selling",
          align: "center",
          exportValue: (row: Product) => toNumber(row.sellingPrice),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Selling" />
        ),
        cell: ({ row }) => (
          <span className="num strong">
            {fmt(toNumber(row.original.sellingPrice))}
          </span>
        ),
      },
      // {
      //   id: "margin",
      //   accessorFn: (row) => productMargin(row),
      //   meta: {
      //     label: "Margin",
      //     align: "center",
      //     exportValue: (row: Product) => `${productMargin(row)}%`,
      //   },
      //   header: ({ column }) => (
      //     <DataTableColumnHeader column={column} title="Margin" />
      //   ),
      //   cell: ({ row }) => (
      //     <span className="num t-emerald">{productMargin(row.original)}%</span>
      //   ),
      // },
      {
        accessorKey: "isActive",
        meta: {
          label: "Status",
          align: "center",
          exportValue: (row: Product) => (row.isActive ? "Active" : "Inactive"),
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
            {/* {toNumber(row.original.averageCost) <= 0 ? (
              <button
                type="button"
                className="dt-act"
                title="Set opening cost"
                onClick={() => setOpeningCostProduct(row.original)}
              >
                <Receipt size={16} />
              </button>
            ) : null} */}
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
    const rows: Product[] = [];
    let totalPages = 1;

    do {
      const response = await listProducts({
        page,
        limit,
        search: debouncedSearch || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
      });
      rows.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return rows;
  }, [debouncedSearch, categoryId]);

  const saveProduct = async (form: ProductFormValues) => {
    const payload = {
      name: form.name.trim(),
      categoryId: Number(form.categoryId),
      model: form.model.trim() || undefined,
      description: form.description.trim() || undefined,
      sellingPrice: Number(form.sellingPrice),
    };

    try {
      if (sheet?.row) {
        await updateProduct.mutateAsync({ id: sheet.row.id, input: payload });
        addToast({ title: "Product updated" });
      } else {
        await createProduct.mutateAsync(payload);
        addToast({ title: "Product added successfully" });
      }
      setSheet(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to save product",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleDeactivate = async () => {
    if (!confirm) return;
    try {
      await deactivateProduct.mutateAsync({ id: confirm.id });
      addToast({ title: "Product deactivated" });
      setConfirm(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to deactivate product",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  // const handleOpeningCost = async (input: SetOpeningCostInput) => {
  //   if (!openingCostProduct) return;
  //   try {
  //     await setOpeningCost.mutateAsync({
  //       productId: openingCostProduct.id,
  //       input,
  //     });
  //     addToast({ title: "Opening cost set" });
  //     setOpeningCostProduct(null);
  //   } catch (e) {
  //     addErrorToast({
  //       title: "Failed to set opening cost",
  //       sub: e instanceof Error ? e.message : "Something went wrong",
  //     });
  //   }
  // };

  const isSaving = createProduct.isPending || updateProduct.isPending;

  return (
    <>
      <PageHeader
        title="Products"
        desc="Product catalog — record purchases to set unit cost"
        action={
          <Button onClick={() => setSheet({ mode: "add" })}>
            <Plus className="size-4" />
            Add Product
          </Button>
        }
      />

      {/* {needsOpeningCostCount > 0 && !missingOpeningCostOnly ? (
        <div className="alert-warning" ...>
          ...
        </div>
      ) : null} */}

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load products."}
        </div>
      )}

      <DataTable
        columns={columns}
        data={products}
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
        searchPlaceholder="Search products…"
        isLoading={isLoading}
        exportFileName="products"
        onExportAll={handleExportAll}
        getRowId={(row) => row.id}
        toolbarExtra={
          <Combobox
            value={categoryId}
            onValueChange={(value) => {
              setCategoryId(value);
              setPageIndex(0);
            }}
            items={categoryItems}
            placeholder="All categories"
            searchPlaceholder="Search categories…"
            emptyText="No categories found."
            clearOption={{ label: "All categories" }}
            className="min-w-[180px]"
          />
        }
        emptyTitle="No products found"
        emptyDescription="Try adjusting your search or category filter."
      />

      {sheet && (
        <ProductSheet
          initial={sheet.row}
          categories={categories}
          onClose={() => setSheet(null)}
          onSave={(form) => void saveProduct(form)}
          isSaving={isSaving}
        />
      )}

      {/* <OpeningCostModal
        open={openingCostProduct !== null}
        product={openingCostProduct}
        onClose={() => setOpeningCostProduct(null)}
        onSave={(input) => void handleOpeningCost(input)}
        isSaving={setOpeningCost.isPending}
      /> */}

      {confirm && (
        <ConfirmDialog
          title="Deactivate product?"
          message="This product will be hidden from sales forms. Historical records are preserved."
          confirmLabel="Deactivate"
          variant="danger"
          isLoading={deactivateProduct.isPending}
          onConfirm={() => void handleDeactivate()}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
