"use client";

import { LayoutGrid, List } from "lucide-react";

import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { Search } from "@/components/ui/search";

export type InventoryStatusFilter = "All" | "Low" | "Out";
export type InventoryView = "table" | "grid";

const STATUS_ITEMS: { value: InventoryStatusFilter; label: string }[] = [
  { value: "All", label: "All status" },
  { value: "Low", label: "Low stock" },
  { value: "Out", label: "Out of stock" },
];

interface InventoryToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  storeId?: string;
  onStoreIdChange: (value: string | undefined) => void;
  storeItems: ComboboxItem[];
  showStoreFilter?: boolean;
  categoryId?: string;
  onCategoryIdChange: (value: string | undefined) => void;
  categoryItems: ComboboxItem[];
  status: InventoryStatusFilter;
  onStatusChange: (status: InventoryStatusFilter) => void;
  view: InventoryView;
  onViewChange: (view: InventoryView) => void;
}

export function InventoryToolbar({
  search,
  onSearchChange,
  storeId,
  onStoreIdChange,
  storeItems,
  showStoreFilter = true,
  categoryId,
  onCategoryIdChange,
  categoryItems,
  status,
  onStatusChange,
  view,
  onViewChange,
}: InventoryToolbarProps) {
  return (
    <div className="filterbar">
      <Search
        placeholder="Search products…"
        value={search}
        onChange={onSearchChange}
      />
      {showStoreFilter ? (
        <Combobox
          value={storeId}
          onValueChange={onStoreIdChange}
          items={storeItems}
          placeholder="All stores"
          searchPlaceholder="Search stores…"
          emptyText="No stores found."
          clearOption={{ label: "All stores" }}
          className="min-w-[160px]"
        />
      ) : null}
      <Combobox
        value={categoryId}
        onValueChange={onCategoryIdChange}
        items={categoryItems}
        placeholder="All categories"
        searchPlaceholder="Search categories…"
        emptyText="No categories found."
        clearOption={{ label: "All categories" }}
        className="min-w-[160px]"
      />
      <Combobox
        value={status}
        onValueChange={(value) =>
          onStatusChange((value as InventoryStatusFilter | undefined) ?? "All")
        }
        items={STATUS_ITEMS}
        placeholder="All status"
        className="min-w-[160px]"
      />
      <span className="spacer" />
      <div className="view-toggle">
        <button
          type="button"
          className={view === "table" ? "vt-on" : ""}
          onClick={() => onViewChange("table")}
          title="Table view"
        >
          <List size={17} />
        </button>
        <button
          type="button"
          className={view === "grid" ? "vt-on" : ""}
          onClick={() => onViewChange("grid")}
          title="Grid view"
        >
          <LayoutGrid size={17} />
        </button>
      </div>
    </div>
  );
}
