"use client";

import { LayoutGrid, List } from "lucide-react";

import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { FilterBtn, Search } from "@/components/ui/search";

export type InventoryStatusFilter = "All" | "Low" | "Out";
export type InventoryView = "table" | "grid";

interface InventoryToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  storeId?: string;
  onStoreIdChange: (value: string | undefined) => void;
  storeItems: ComboboxItem[];
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
      {(["All", "Low", "Out"] as InventoryStatusFilter[]).map((s) => (
        <FilterBtn
          key={s}
          label={
            s === "All"
              ? "All status"
              : s === "Low"
                ? "Low stock"
                : "Out of stock"
          }
          active={status === s}
          onClick={() => onStatusChange(s)}
        />
      ))}
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
