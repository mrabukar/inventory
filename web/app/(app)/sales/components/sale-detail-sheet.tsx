"use client";

import { Button } from "@/components/ui/button";
import { CategoryBadge, SaleStatusBadge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { formatSaleDate, toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { saleProfit, type Sale } from "@/types/sales/sale";

interface SaleDetailSheetProps {
  sale: Sale;
  onClose: () => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span className="muted">{label}</span>
      <span className="strong" style={{ textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

export function SaleDetailSheet({ sale, onClose }: SaleDetailSheetProps) {
  const profit = saleProfit(sale);

  return (
    <Sheet
      title={sale.product.name}
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <SaleStatusBadge status={sale.status} />
        <CategoryBadge cat={sale.product.category.name} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DetailRow label="Store" value={sale.store.name} />
        <DetailRow label="Manager" value={sale.soldBy.name} />
        <DetailRow label="Sale date" value={formatSaleDate(sale.saleDate)} />
        <DetailRow label="Quantity" value={sale.quantitySold} />
        <DetailRow
          label="Unit price"
          value={fmt(toNumber(sale.unitPrice))}
        />
        <DetailRow
          label="Unit cost"
          value={fmt(toNumber(sale.unitPurchasePrice))}
        />
        <DetailRow
          label="Total"
          value={fmt(toNumber(sale.totalAmount))}
        />
        <DetailRow
          label="Profit"
          value={
            <span className={profit >= 0 ? "t-emerald" : "t-rose"}>
              {fmt(profit)}
            </span>
          }
        />
        {sale.note ? (
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Note
            </div>
            <div>{sale.note}</div>
          </div>
        ) : null}
      </div>

      {sale.corrections.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Corrections
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sale.corrections.map((correction) => (
              <div
                key={correction.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                }}
              >
                <div className="strong" style={{ marginBottom: 4 }}>
                  {correction.originalQuantity} → {correction.correctedQuantity}{" "}
                  units
                </div>
                <div style={{ marginBottom: 4 }}>{correction.reason}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {formatRelativeTime(correction.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
