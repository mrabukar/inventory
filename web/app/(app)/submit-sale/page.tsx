"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Store, Trash2, User } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { useCreateSale } from "@/hooks/sales/use-create-sale";
import { useCustomers } from "@/hooks/customers/use-customers";
import {
  useCreateSaleLocation,
  useSaleLocations,
} from "@/hooks/sale-locations/use-sale-locations";
import { todayYmd } from "@/lib/filters/dates";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";

const inputClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface LineRow {
  key: number;
  productId?: string;
  qty: string;
}

let nextKey = 1;
const newRow = (): LineRow => ({ key: nextKey++, qty: "" });

function FormField({
  label,
  required,
  error,
  helper,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
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
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

export default function SubmitSalePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const hasStores = user?.hasStores ?? true;
  const billingEnabled = user?.billingEnabled ?? false;
  const locationLabel = hasStores
    ? (user?.store ?? "My Store")
    : (user?.organizationName ?? "Organization");

  const { data, isLoading } = useInventory({ limit: 100 });
  const createSale = useCreateSale();
  const { data: customersData } = useCustomers({ limit: 100 });
  const customers = useMemo(
    () => customersData?.data ?? [],
    [customersData?.data],
  );
  const { data: saleLocations } = useSaleLocations(billingEnabled);
  const createLocation = useCreateSaleLocation();

  const inStock = useMemo(
    () => (data?.data ?? []).filter((row) => row.quantity > 0),
    [data],
  );

  const [rows, setRows] = useState<LineRow[]>([newRow()]);
  const [saleDate, setSaleDate] = useState(todayYmd());
  const [note, setNote] = useState("");
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [locationId, setLocationId] = useState<string | undefined>();
  const [newLocation, setNewLocation] = useState("");
  const [addingLocation, setAddingLocation] = useState(false);
  const [paidNow, setPaidNow] = useState("");
  // When false the field stays in sync with the sale total automatically.
  // Flips to true the moment the user manually edits the field.
  const [paidNowTouched, setPaidNowTouched] = useState(false);

  const customerItems = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.phone ? `${c.name} · ${c.phone}` : c.name,
        keywords: [c.name, c.phone ?? ""],
      })),
    [customers],
  );
  const locationItems = useMemo(
    () => (saleLocations ?? []).map((l) => ({ value: l.id, label: l.name })),
    [saleLocations],
  );

  const addLocation = async () => {
    const name = newLocation.trim();
    if (!name) return;
    try {
      const created = await createLocation.mutateAsync({ name });
      setLocationId(created.id);
      setNewLocation("");
      setAddingLocation(false);
    } catch (e) {
      addErrorToast({
        title: "Failed to add location",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const selectedIds = rows
    .map((r) => r.productId)
    .filter((id): id is string => Boolean(id));

  const rowFor = (row: LineRow) =>
    inStock.find((s) => s.productId === row.productId);

  const productItemsFor = (row: LineRow) =>
    inStock
      .filter(
        (s) =>
          s.productId === row.productId || !selectedIds.includes(s.productId),
      )
      .map((s) => ({
        value: s.productId,
        label: `${formatProductLabel(s.product.name, s.product.model)} · ${s.product.category.name} · ${s.quantity} available`,
        keywords: [
          s.product.name,
          s.product.model ?? "",
          s.product.category.name,
        ],
      }));

  const lineTotal = (row: LineRow) => {
    const inv = rowFor(row);
    const q = row.qty === "" ? 0 : parseInt(row.qty, 10);
    return q * (inv ? toNumber(inv.product.sellingPrice) : 0);
  };
  const total = rows.reduce((sum, row) => sum + lineTotal(row), 0);

  // Keep "Amount paid now" in sync with the running total unless the user
  // has overridden it. Resets to "" when all items are removed (total === 0).
  useEffect(() => {
    if (paidNowTouched) return;
    setPaidNow(total > 0 ? String(total) : "");
  }, [total, paidNowTouched]);

  const rowOver = (row: LineRow) => {
    const inv = rowFor(row);
    const q = row.qty === "" ? 0 : parseInt(row.qty, 10);
    return Boolean(inv) && q > (inv?.quantity ?? 0);
  };

  const validRows = rows.filter((row) => {
    const q = row.qty === "" ? 0 : parseInt(row.qty, 10);
    return row.productId && q >= 1 && !rowOver(row);
  });

  const parsedPaid =
    paidNow.trim() === "" ? 0 : Number(paidNow);
  const paidNowInvalid =
    billingEnabled &&
    (Number.isNaN(parsedPaid) || parsedPaid < 0 || parsedPaid > total + 0.001);
  const balanceAfter = Math.max(0, total - (parsedPaid || 0));
  // Billing orgs require a customer whenever the sale isn't fully paid.
  const needsCustomer = billingEnabled && parsedPaid < total - 0.001;
  const canSubmit =
    validRows.length === rows.length &&
    rows.length > 0 &&
    !paidNowInvalid &&
    (!needsCustomer || Boolean(customerId));

  const updateRow = (key: number, patch: Partial<LineRow>) =>
    setRows((state) =>
      state.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const removeRow = (key: number) =>
    setRows((state) =>
      state.length === 1 ? state : state.filter((r) => r.key !== key),
    );

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await createSale.mutateAsync({
        items: validRows.map((row) => ({
          productId: row.productId!,
          quantitySold: parseInt(row.qty, 10),
        })),
        saleDate,
        customerId: billingEnabled ? customerId : undefined,
        locationId: billingEnabled ? locationId : undefined,
        paidAmount: billingEnabled ? parsedPaid || 0 : undefined,
        note: note.trim() || undefined,
      });
      const units = validRows.reduce(
        (sum, row) => sum + parseInt(row.qty, 10),
        0,
      );
      addToast({
        title: "Sale recorded successfully",
        sub: `${units} unit${units === 1 ? "" : "s"} — ${fmt(total)}`,
      });
      router.push("/dashboard");
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

      <Card bodyClass="px-5 py-4">
        <div className="grid gap-4">
          <div className="grid gap-3">
            {rows.map((row) => {
              const over = rowOver(row);
              return (
                <div
                  key={row.key}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-end"
                >
                  <FormField label="Product" required>
                    <Combobox
                      value={row.productId}
                      onValueChange={(value) =>
                        updateRow(row.key, { productId: value })
                      }
                      items={productItemsFor(row)}
                      placeholder="Select a product…"
                      searchPlaceholder="Search products…"
                      emptyText="No in-stock products found."
                      loading={isLoading}
                      disabled={isLoading}
                      className="h-9 w-full min-w-0"
                    />
                  </FormField>
                  <FormField
                    label="Qty"
                    required
                    error={
                      over
                        ? `Only ${rowFor(row)?.quantity ?? 0} available`
                        : undefined
                    }
                  >
                    <input
                      className={cn(
                        inputClassName,
                        over && "border-destructive",
                      )}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={row.qty}
                      onChange={(e) =>
                        updateRow(row.key, {
                          qty: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      placeholder="0"
                      disabled={!row.productId}
                    />
                  </FormField>
                  <button
                    type="button"
                    className="dt-act mb-1 shrink-0"
                    title="Remove item"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    style={rows.length === 1 ? { opacity: 0.35 } : undefined}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            {/* Add item — hidden for store-based orgs (one entry per sale for now) */}
            {!hasStores && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setRows((state) => [...state, newRow()])}
              >
                <Plus className="size-4" />
                Add item
              </Button>
            )}
          </div>

          <FormField label="Sale date" required className="sm:max-w-[220px]">
            <input
              className={inputClassName}
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </FormField>

          {billingEnabled ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Customer">
                <Combobox
                  value={customerId}
                  onValueChange={setCustomerId}
                  items={customerItems}
                  placeholder="Select a customer…"
                  searchPlaceholder="Search customers…"
                  emptyText="No customers. Add one on the Customers page."
                  className="h-9 w-full"
                />
              </FormField>
              <FormField label="Location">
                {addingLocation ? (
                  <div className="flex gap-2">
                    <input
                      className={inputClassName}
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="New location name"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void addLocation()}
                      disabled={createLocation.isPending || !newLocation.trim()}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAddingLocation(false);
                        setNewLocation("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Combobox
                      value={locationId}
                      onValueChange={setLocationId}
                      items={locationItems}
                      placeholder="Select a location…"
                      searchPlaceholder="Search locations…"
                      emptyText="No locations yet."
                      className="h-9 w-full min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setAddingLocation(true)}
                    >
                      <Plus className="size-4" />
                      New
                    </Button>
                  </div>
                )}
              </FormField>
            </div>
          ) : null}

          {billingEnabled ? (
            <FormField
              label="Amount paid now"
              className="sm:max-w-[280px]"
              error={
                paidNowInvalid
                  ? `Must be between 0 and ${fmt(total)}`
                  : needsCustomer && !customerId
                    ? "Customer is required when the sale isn't fully paid"
                    : undefined
              }
              helper={
                !paidNowInvalid && total > 0
                  ? balanceAfter === 0
                    ? "Fully paid — no balance"
                    : `Balance ${fmt(balanceAfter)} will be added to the customer's outstanding.`
                  : undefined
              }
            >
              <div className="flex gap-2">
                <input
                  className={cn(
                    inputClassName,
                    paidNowInvalid && "border-destructive",
                  )}
                  type="number"
                  min={0}
                  step="0.01"
                  value={paidNow}
                  onChange={(e) => {
                    setPaidNowTouched(true);
                    setPaidNow(e.target.value);
                  }}
                  placeholder="0.00"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={total <= 0}
                  onClick={() => {
                    setPaidNow(String(total));
                    setPaidNowTouched(false); // re-enable auto-sync
                  }}
                >
                  Full
                </Button>
              </div>
            </FormField>
          ) : null}

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
              <p className="text-sm text-muted-foreground">Sale total</p>
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
              disabled={!canSubmit || createSale.isPending}
            >
              {createSale.isPending ? "Recording…" : "Record Sale"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
