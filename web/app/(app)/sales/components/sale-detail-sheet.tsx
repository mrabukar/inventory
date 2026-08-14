"use client";

import { Button } from "@/components/ui/button";
import { SaleStatusBadge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { formatProductLabel } from "@/lib/products/format";
import { formatSaleDate, toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { saleProfit, saleUnitsSold, type Sale } from "@/types/sales/sale";

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
  const hasCost = sale.items.some((item) => item.unitPurchasePrice != null);
  const profit = saleProfit(sale);
  const itemNameById = new Map(
    sale.items.map((item) => [
      item.id,
      formatProductLabel(item.product.name, item.product.model),
    ]),
  );

  return (
    <Sheet
      title={sale.customer?.name ?? "Sale details"}
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <SaleStatusBadge status={sale.status} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DetailRow label="Store" value={sale.store.name} />
        <DetailRow label="Sold by" value={sale.soldBy.name} />
        {sale.customer ? (
          <DetailRow label="Customer" value={sale.customer.name} />
        ) : null}
        <DetailRow label="Sale date" value={formatSaleDate(sale.saleDate)} />
        <DetailRow label="Total units" value={saleUnitsSold(sale)} />
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Items</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sale.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
              }}
            >
              <div className="min-w-0">
                <div className="strong">
                  {formatProductLabel(item.product.name, item.product.model)}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {item.quantitySold} × {fmt(toNumber(item.unitPrice))}
                  {hasCost && item.unitPurchasePrice != null
                    ? ` · cost ${fmt(toNumber(item.unitPurchasePrice))}`
                    : ""}
                </div>
              </div>
              <div className="num strong">{fmt(toNumber(item.lineTotal))}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}
      >
        <DetailRow
          label="Total"
          value={
            <span className="t-indigo">{fmt(toNumber(sale.totalAmount))}</span>
          }
        />
        {hasCost ? (
          <DetailRow
            label="Profit"
            value={
              <span className={profit >= 0 ? "t-emerald" : "t-rose"}>
                {fmt(profit)}
              </span>
            }
          />
        ) : null}
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
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  {itemNameById.get(correction.saleItemId) ?? "Item"}
                </div>
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
