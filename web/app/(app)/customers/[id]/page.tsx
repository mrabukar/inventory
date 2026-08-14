"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";

import { CustomerModal } from "../components/customer-modal";
import { RecordPaymentModal } from "../../payments/components/record-payment-modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useCustomer } from "@/hooks/customers/use-customers";
import { useUpdateCustomer } from "@/hooks/customers/use-mutate-customer";
import {
  useCreatePayment,
  useCustomerBalance,
  useCustomerStatement,
} from "@/hooks/payments/use-payments";
import { formatDisplayDate } from "@/lib/filters/dates";
import { fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { CreateCustomerInput } from "@/types/customers/customer";
import type { CreatePaymentInput } from "@/types/payments/payment";

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const billingEnabled = useAppStore((s) => s.user?.billingEnabled ?? false);
  const [editing, setEditing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const { data: customer, isPending, isError, error } = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const createPayment = useCreatePayment();

  const enableBilling = billingEnabled && Boolean(id);
  const { data: balance } = useCustomerBalance(enableBilling ? id : undefined);
  const { data: statement } = useCustomerStatement(
    enableBilling ? id : undefined,
  );

  const handleSave = async (input: CreateCustomerInput) => {
    if (!customer) return;
    try {
      await updateCustomer.mutateAsync({ id: customer.id, input });
      addToast({ title: "Customer updated" });
      setEditing(false);
    } catch (e) {
      addErrorToast({
        title: "Failed to update customer",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleRecordPayment = async (input: CreatePaymentInput) => {
    try {
      await createPayment.mutateAsync(input);
      addToast({ title: "Payment recorded" });
      setPayOpen(false);
    } catch (e) {
      addErrorToast({
        title: "Failed to record payment",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  return (
    <>
      <Link
        href="/customers"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to customers
      </Link>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError || !customer ? (
        <div className="alert-error">
          {error instanceof Error ? error.message : "Customer not found."}
        </div>
      ) : (
        <>
          <PageHeader
            title={customer.name}
            desc="Customer profile"
            action={
              <div className="flex flex-wrap gap-2">
                {billingEnabled ? (
                  <Button onClick={() => setPayOpen(true)}>
                    <Plus className="size-4" />
                    Record payment
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </div>
            }
          />

          <div className="rounded-lg border border-border bg-background p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Name" value={customer.name} />
              <DetailRow label="Phone" value={customer.phone} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="Address" value={customer.address} />
              <DetailRow label="Note" value={customer.note} />
            </div>
          </div>

          {billingEnabled && balance ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">Total billed</p>
                <p className="num mt-1 text-xl font-bold">
                  {fmt(balance.totalBilled)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">Total paid</p>
                <p className="num t-emerald mt-1 text-xl font-bold">
                  {fmt(balance.totalPaid)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Outstanding balance
                </p>
                <p
                  className={`num mt-1 text-xl font-bold ${balance.balance > 0 ? "t-rose" : "t-emerald"}`}
                >
                  {fmt(balance.balance)}
                </p>
                {balance.unpaidInvoiceCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Across {balance.unpaidInvoiceCount} unpaid invoice
                    {balance.unpaidInvoiceCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {billingEnabled && statement ? (
            <div className="mt-4 rounded-lg border border-border bg-background">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Statement</h2>
                <p className="text-xs text-muted-foreground">
                  All invoices and payments with a running balance.
                </p>
              </div>
              {statement.rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No activity yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="dt-table">
                    <thead className="dt-head">
                      <tr>
                        <th className="dt-th-left">Date</th>
                        <th className="dt-th-left">Reference</th>
                        <th className="dt-th-left">Description</th>
                        <th className="dt-th-right">Charge</th>
                        <th className="dt-th-right">Payment</th>
                        <th className="dt-th-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="dt-body">
                      {statement.rows.map((row, i) => (
                        <tr key={i} className="dt-row">
                          <td className="dt-cell-left">
                            <span className="muted">
                              {formatDisplayDate(row.date)}
                            </span>
                          </td>
                          <td className="dt-cell-left">
                            <span className="strong">{row.reference}</span>
                          </td>
                          <td className="dt-cell-left">
                            <span className="muted">{row.description}</span>
                          </td>
                          <td className="dt-cell-right">
                            {row.charge != null ? (
                              <span className="num">{fmt(row.charge)}</span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="dt-cell-right">
                            {row.payment != null ? (
                              <span className="num t-emerald">
                                {fmt(row.payment)}
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="dt-cell-right">
                            <span
                              className={`num strong ${row.balance > 0 ? "t-rose" : ""}`}
                            >
                              {fmt(row.balance)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          <CustomerModal
            key={editing ? "edit" : "closed"}
            open={editing}
            customer={customer}
            onClose={() => setEditing(false)}
            onSave={(form) => void handleSave(form)}
            isSaving={updateCustomer.isPending}
          />

          <RecordPaymentModal
            key={payOpen ? "pay" : "closed"}
            open={payOpen}
            defaultCustomerId={customer.id}
            onClose={() => setPayOpen(false)}
            onSave={(form) => void handleRecordPayment(form)}
            isSaving={createPayment.isPending}
          />
        </>
      )}
    </>
  );
}
