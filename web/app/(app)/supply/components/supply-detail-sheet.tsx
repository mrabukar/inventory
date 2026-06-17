"use client";

import { Button } from "@/components/ui/button";
import { SupplyTypeBadge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import {
  supplyInvestment,
  supplyTypeLabel,
  type StockSupply,
} from "@/types/stock-supplies/stock-supply";

interface SupplyDetailSheetProps {
  supply: StockSupply;
  onClose: () => void;
  onFix: (supply: StockSupply) => void;
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

function formatQuantity(qty: number): string {
  if (qty > 0) return `+${qty}`;
  return String(qty);
}

export function SupplyDetailSheet({
  supply,
  onClose,
  onFix,
}: SupplyDetailSheetProps) {
  return (
    <Sheet
      title={formatProductLabel(supply.product.name, supply.product.model)}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={() => onFix(supply)}>
            Fix this supply
          </Button>
        </>
      }
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}
      >
        <SupplyTypeBadge type={supply.type} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DetailRow label="Store" value={supply.store.name} />
        <DetailRow label="Supplied by" value={supply.suppliedBy.name} />
        <DetailRow
          label="Date"
          value={formatRelativeTime(supply.createdAt)}
        />
        <DetailRow label="Quantity" value={formatQuantity(supply.quantity)} />
        <DetailRow
          label="Unit cost"
          value={fmt(toNumber(supply.unitPurchasePrice))}
        />
        <DetailRow
          label="Total investment"
          value={fmt(supplyInvestment(supply))}
        />
        <DetailRow label="Record type" value={supplyTypeLabel(supply.type)} />
        {supply.note ? (
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Note
            </div>
            <div>{supply.note}</div>
          </div>
        ) : null}
        {supply.correctsSupply ? (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg2)",
            }}
          >
            <div className="muted" style={{ marginBottom: 4 }}>
              Fixes supply
            </div>
            <div className="strong">
              {formatQuantity(supply.correctsSupply.quantity)} ·{" "}
              {supplyTypeLabel(supply.correctsSupply.type)} ·{" "}
              {formatRelativeTime(supply.correctsSupply.createdAt)}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
