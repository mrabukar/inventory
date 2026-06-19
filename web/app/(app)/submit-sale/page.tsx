"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Store, User } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { useCreateSale } from "@/hooks/sales/use-create-sale";
import { todayYmd } from "@/lib/filters/dates";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { Sale } from "@/types/sales/sale";

const inputClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function FormField({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label className="text-sm font-medium leading-none">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export default function SubmitSalePage() {
  const user = useAppStore((s) => s.user);
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const hasStores = user?.hasStores ?? true;
  const locationLabel = hasStores
    ? (user?.store ?? "My Store")
    : (user?.organizationName ?? "Organization");

  const { data, isLoading } = useInventory({ limit: 100 });
  const createSale = useCreateSale();

  const inStock = useMemo(
    () => (data?.data ?? []).filter((row) => row.quantity > 0),
    [data],
  );

  const productItems = useMemo(
    () =>
      inStock.map((row) => ({
        value: row.productId,
        label: `${formatProductLabel(row.product.name, row.product.model)} · ${row.product.category.name} · ${row.quantity} available`,
        keywords: [row.product.name, row.product.model ?? "", row.product.category.name],
      })),
    [inStock],
  );

  const [productId, setProductId] = useState<string | undefined>();
  const [qty, setQty] = useState("");
  const [saleDate, setSaleDate] = useState(todayYmd());
  const [note, setNote] = useState("");
  const [done, setDone] = useState<Sale | null>(null);

  const selected = inStock.find((row) => row.productId === productId);
  const avail = selected?.quantity ?? 0;
  const price = selected ? toNumber(selected.product.sellingPrice) : 0;
  const q = qty === "" ? 0 : parseInt(qty, 10);
  const over = q > avail;
  const total = q * price;

  const handleQtyChange = (value: string) => {
    if (value === "") {
      setQty("");
      return;
    }
    setQty(value.replace(/\D/g, ""));
  };

  const submit = async () => {
    if (!productId || !qty || q < 1 || over) return;

    try {
      const sale = await createSale.mutateAsync({
        productId,
        quantitySold: q,
        saleDate,
        note: note.trim() || undefined,
      });
      setDone(sale);
      addToast({
        title: "Sale recorded successfully",
        sub: `${q} × ${formatProductLabel(sale.product.name, sale.product.model)} — ${fmt(toNumber(sale.totalAmount))}`,
      });
      setProductId(undefined);
      setQty("");
      setNote("");
    } catch (e) {
      addErrorToast({
        title: "Failed to record sale",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  return (
    <div className="submit-sale-page mx-auto w-full max-w-3xl">
      <PageHeader title="Submit Sale" desc={locationLabel} />

      {done && (
        <div
          className="card mb-4 flex items-center gap-3 px-4 py-3"
          style={{
            background: "var(--tint-emerald)",
            borderColor:
              "color-mix(in srgb, var(--status-emerald) 25%, transparent)",
          }}
        >
          <CheckCircle2
            size={20}
            style={{ color: "var(--status-emerald)", flexShrink: 0 }}
          />
          <p className="text-sm">
            You recorded{" "}
            <b>
              {done.quantitySold} ×{" "}
              {formatProductLabel(done.product.name, done.product.model)}
            </b>{" "}
            — <b>{fmt(toNumber(done.totalAmount))}</b>
          </p>
        </div>
      )}

      <Card bodyClass="px-5 py-4">
        <div className="grid gap-4">
          <FormField label="Product" required>
            <Combobox
              value={productId}
              onValueChange={setProductId}
              items={productItems}
              placeholder="Select a product…"
              searchPlaceholder="Search products…"
              emptyText="No in-stock products found."
              loading={isLoading}
              disabled={isLoading}
              className="h-9 w-full min-w-0"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Quantity"
              required
              error={over ? `Only ${avail} units available` : undefined}
            >
              <input
                className={cn(inputClassName, over && "border-destructive")}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={qty}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="0"
                disabled={!productId}
              />
            </FormField>

            <FormField label="Sale date" required>
              <input
                className={inputClassName}
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Note">
            <textarea
              className={cn(inputClassName, "h-auto min-h-24 resize-y py-2")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note about this sale"
              maxLength={500}
              rows={2}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="readout py-2">
              <Store size={15} />
              {locationLabel}
            </div>
            <div className="readout py-2">
              <User size={15} />
              {user?.name}
            </div>
          </div>

          <div
            className="flex flex-col gap-3 rounded-md px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: "var(--tint-indigo)" }}
          >
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {price
                  ? `${fmt(price)} per unit`
                  : "Select a product to see price"}
              </p>
              <p
                className="num text-2xl font-bold leading-tight"
                style={{ color: "var(--brand-indigo)" }}
              >
                {fmt(total)}
              </p>
            </div>
            <Button
              variant="default"
              size="default"
              className="w-full shrink-0 sm:w-auto sm:min-w-[140px]"
              onClick={submit}
              disabled={
                !productId || !qty || q < 1 || over || createSale.isPending
              }
            >
              {createSale.isPending ? "Recording…" : "Record Sale"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
