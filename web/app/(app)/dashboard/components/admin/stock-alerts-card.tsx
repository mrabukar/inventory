import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Props {
  lowStockCount: number;
  outOfStockCount: number;
}

export function AdminStockAlertsCard({ lowStockCount, outOfStockCount }: Props) {
  if (lowStockCount <= 0 && outOfStockCount <= 0) return null;

  return (
    <Card title="Stock Alerts" titleIcon={AlertTriangle}>
      <p className="muted" style={{ marginBottom: 12 }}>
        {lowStockCount} low-stock and {outOfStockCount} out-of-stock items company-wide.
      </p>
      <Link href="/inventory" className="btn btn-outline btn-sm">
        View inventory alerts
      </Link>
    </Card>
  );
}
