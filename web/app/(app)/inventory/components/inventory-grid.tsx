"use client";

import { Store } from "lucide-react";

import { CategoryBadge, StockBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Inventory } from "@/types/inventory/inventory";

const fillColor = (qty: number, threshold: number) =>
  qty <= 0
    ? "var(--status-rose)"
    : qty <= threshold
      ? "var(--status-amber)"
      : "var(--status-emerald)";

interface InventoryGridProps {
  rows: Inventory[];
  isLoading?: boolean;
}

export function InventoryGrid({ rows, isLoading = false }: InventoryGridProps) {
  if (isLoading) {
    return (
      <div className="muted" style={{ padding: 24 }}>
        Loading inventory…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        title="No inventory records"
        sub="Try adjusting your filters."
      />
    );
  }

  return (
    <div className="inv-grid">
      {rows.map((row) => (
        <div className="inv-card" key={row.id}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div className="ic-name">{row.product.name}</div>
              <div className="ic-store">
                <Store size={13} />
                {row.store.name}
              </div>
            </div>
            <CategoryBadge cat={row.product.category.name} />
          </div>
          <div
            className="ic-qty num"
            style={{
              color: fillColor(row.quantity, row.lowStockThreshold),
            }}
          >
            {row.quantity}
          </div>
          <div className="ic-prog">
            <div
              className="ic-fill"
              style={{
                width:
                  Math.min(
                    100,
                    (row.quantity / (row.lowStockThreshold * 3)) * 100,
                  ) + "%",
                background: fillColor(row.quantity, row.lowStockThreshold),
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <StockBadge
              qty={row.quantity}
              threshold={row.lowStockThreshold}
            />
            <span className="num" style={{ fontSize: 12, color: "var(--fg3)" }}>
              thr {row.lowStockThreshold}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
