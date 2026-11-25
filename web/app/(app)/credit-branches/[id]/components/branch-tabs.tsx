"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { BranchStatementCard } from "@/components/credit-branches/branch-statement-card";
import { BranchPaymentStatusBadge } from "@/components/credit-branches/payment-status-badge";
import { Pager } from "@/components/credit-branches/pager";
import { Badge } from "@/components/ui/badge";
import { StockBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBranchReceivables,
  useBranchTabList,
  usePageAccess,
} from "@/hooks/credit-branches/use-branch-overview";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { saleProductSummary, saleUnitsSold, SALE_STATUS_LABEL } from "@/types/sales/sale";
import type { Sale, SaleStatus } from "@/types/sales/sale";
import type { Inventory } from "@/types/inventory/inventory";
import type { Customer } from "@/types/customers/customer";
import type { Expense } from "@/types/expenses/expense";
import { formatExpenseDate } from "@/types/expenses/expense";
import type { User } from "@/types/users/user";
import { roleLabel } from "@/types/users/user";
import type { AuditLog } from "@/types/audit/audit-log";
import {
  branchPaymentMethodLabel,
  type BranchPayment,
} from "@/types/credit-branches/credit-branch";

type TabKey =
  | "statement"
  | "stock"
  | "sales"
  | "payments"
  | "customers"
  | "expenses"
  | "people"
  | "activity";

interface TabDef {
  key: TabKey;
  label: string;
  /** Pages that open this tab's data for a limited user; none means everyone. */
  pages: string[] | null;
}

const TABS: TabDef[] = [
  { key: "statement", label: "Statement", pages: null },
  { key: "stock", label: "Stock", pages: ["inventory", "warehouse", "purchases", "dashboard"] },
  { key: "sales", label: "Sales", pages: ["sales", "sale-approvals"] },
  { key: "payments", label: "Payments", pages: ["branch-payments"] },
  { key: "customers", label: "Customers", pages: ["customers", "payments", "invoices", "receivables"] },
  { key: "expenses", label: "Expenses", pages: ["expenses"] },
  { key: "people", label: "People", pages: ["users", "audit"] },
  { key: "activity", label: "Activity", pages: ["audit"] },
];

const PAGE_SIZE = 10;

const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const day = (iso: string) => dayFmt.format(new Date(iso));
const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const SALE_COLOR: Record<SaleStatus, "amber" | "emerald" | "violet" | "rose"> = {
  pending: "amber",
  active: "emerald",
  corrected: "violet",
  rejected: "rose",
};

interface Column<T> {
  head: string;
  align?: "right";
  render: (row: T) => React.ReactNode;
}

function Panel<T>({
  id,
  tab,
  columns,
  empty,
  rowKey,
}: {
  id: string;
  tab: Exclude<TabKey, "statement">;
  columns: Column<T>[];
  empty: { title: string; sub: string };
  rowKey: (row: T) => string;
}) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isPlaceholderData } = useBranchTabList<T>(
    id,
    tab,
    page,
    PAGE_SIZE,
  );

  if (isPending) {
    return (
      <div style={{ display: "grid", gap: 8, padding: 24 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="Couldn't load this list"
        sub="You may not have access to it, or try again."
      />
    );
  }
  if (data.total === 0) {
    return <EmptyState title={empty.title} sub={empty.sub} />;
  }

  return (
    <>
      <div
        style={{
          overflowX: "auto",
          opacity: isPlaceholderData ? 0.6 : 1,
          transition: "opacity .15s",
        }}
      >
        <table style={{ width: "100%", minWidth: 560, fontSize: 14, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.head}
                  scope="col"
                  style={{
                    padding: i === 0 ? "12px 12px 12px 24px" : "12px",
                    textAlign: c.align === "right" ? "right" : "left",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--fg2)",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.data.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c, i) => (
                  <td
                    key={c.head}
                    style={{
                      padding: i === 0 ? "12px 12px 12px 24px" : "12px",
                      textAlign: c.align === "right" ? "right" : "left",
                      color: "var(--fg1)",
                      borderBottom: "1px solid var(--border)",
                      verticalAlign: "middle",
                    }}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        limit={PAGE_SIZE}
        total={data.total}
        onPageChange={setPage}
        busy={isPlaceholderData}
      />
    </>
  );
}

const muted = (text: string) => <span style={{ color: "var(--fg3)" }}>{text}</span>;
const num = (text: string) => <span className="num">{text}</span>;

function StockPanel({ id }: { id: string }) {
  return (
    <Panel<Inventory>
      id={id}
      tab="stock"
      rowKey={(r) => r.id}
      empty={{ title: "No stock here", sub: "Credit stock to this branch and it shows up here." }}
      columns={[
        {
          head: "Product",
          render: (r) => (
            <span>
              {r.product.name}
              {r.product.model ? ` (${r.product.model})` : ""}
            </span>
          ),
        },
        { head: "Category", render: (r) => r.product.category?.name ?? muted("None") },
        { head: "Units", align: "right", render: (r) => num(r.quantity.toLocaleString()) },
        {
          head: "Level",
          render: (r) => <StockBadge qty={r.quantity} threshold={r.lowStockThreshold} />,
        },
      ]}
    />
  );
}

function SalesPanel({ id }: { id: string }) {
  return (
    <Panel<Sale>
      id={id}
      tab="sales"
      rowKey={(r) => r.id}
      empty={{ title: "No sales yet", sub: "This branch hasn't sold anything." }}
      columns={[
        { head: "Date", render: (r) => day(r.saleDate) },
        { head: "Items", render: (r) => saleProductSummary(r) },
        { head: "Customer", render: (r) => r.customer?.name ?? muted("Walk-in") },
        { head: "Units", align: "right", render: (r) => num(String(saleUnitsSold(r))) },
        {
          head: "Status",
          render: (r) => <Badge color={SALE_COLOR[r.status]}>{SALE_STATUS_LABEL[r.status]}</Badge>,
        },
        { head: "Total", align: "right", render: (r) => num(fmt(toNumber(r.totalAmount))) },
      ]}
    />
  );
}

function PaymentsPanel({ id }: { id: string }) {
  return (
    <Panel<BranchPayment>
      id={id}
      tab="payments"
      rowKey={(r) => r.id}
      empty={{ title: "No payments yet", sub: "Payments the branch sends you show up here." }}
      columns={[
        { head: "Paid on", render: (r) => day(r.paidAt) },
        { head: "Method", render: (r) => branchPaymentMethodLabel(r.method) },
        { head: "Reference", render: (r) => r.reference || muted("None") },
        { head: "Sent by", render: (r) => r.submittedBy?.name ?? muted("Unknown") },
        { head: "Status", render: (r) => <BranchPaymentStatusBadge status={r.status} /> },
        { head: "Amount", align: "right", render: (r) => num(fmt(toNumber(r.amount))) },
      ]}
    />
  );
}

function CustomersPanel({ id }: { id: string }) {
  const { data: owed } = useBranchReceivables(id);
  const byCustomer = useMemo(
    () => new Map((owed ?? []).map((r) => [r.customer?.id ?? "", r.balance])),
    [owed],
  );
  return (
    <Panel<Customer>
      id={id}
      tab="customers"
      rowKey={(r) => r.id}
      empty={{ title: "No customers yet", sub: "The branch adds its own customers." }}
      columns={[
        { head: "Name", render: (r) => r.name },
        { head: "Phone", render: (r) => r.phone || muted("None") },
        { head: "Added", render: (r) => day(r.createdAt) },
        {
          head: "Owes the branch",
          align: "right",
          render: (r) => {
            const balance = byCustomer.get(r.id) ?? 0;
            return balance > 0 ? (
              <span className="num" style={{ color: "var(--status-rose)", fontWeight: 500 }}>
                {fmt(balance)}
              </span>
            ) : (
              muted("Nothing")
            );
          },
        },
      ]}
    />
  );
}

function ExpensesPanel({ id }: { id: string }) {
  return (
    <Panel<Expense>
      id={id}
      tab="expenses"
      rowKey={(r) => r.id}
      empty={{ title: "No expenses booked", sub: "Expenses booked to this branch show up here." }}
      columns={[
        { head: "Date", render: (r) => day(formatExpenseDate(r.expenseDate)) },
        { head: "Title", render: (r) => r.title },
        { head: "Category", render: (r) => r.category?.name ?? muted("None") },
        { head: "Booked by", render: (r) => r.createdBy?.name ?? muted("Unknown") },
        { head: "Amount", align: "right", render: (r) => num(fmt(toNumber(r.amount))) },
      ]}
    />
  );
}

function PeoplePanel({ id }: { id: string }) {
  return (
    <Panel<User>
      id={id}
      tab="people"
      rowKey={(r) => r.id}
      empty={{ title: "No one is assigned", sub: "Add a branch manager under Users." }}
      columns={[
        { head: "Name", render: (r) => r.name },
        { head: "Email", render: (r) => r.email },
        { head: "Role", render: (r) => roleLabel(r.role) },
        {
          head: "Status",
          render: (r) => (
            <Badge color={r.isActive ? "emerald" : "slate"}>
              {r.isActive ? "Active" : "Inactive"}
            </Badge>
          ),
        },
      ]}
    />
  );
}

function sentence(action: string): string {
  const text = action.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ActivityPanel({ id }: { id: string }) {
  return (
    <Panel<AuditLog>
      id={id}
      tab="activity"
      rowKey={(r) => r.id}
      empty={{ title: "No activity yet", sub: "What this branch's people do is recorded here." }}
      columns={[
        { head: "When", render: (r) => timeFmt.format(new Date(r.createdAt)) },
        { head: "Who", render: (r) => r.user?.name ?? muted("Unknown") },
        { head: "What", render: (r) => sentence(r.action) },
        { head: "On", render: (r) => r.entityType.replace(/_/g, " ") },
      ]}
    />
  );
}

/**
 * The branch's records, one tab each. Only the open tab loads, so the page
 * stays quick; a limited user only sees the tabs their pages allow.
 */
export function BranchTabs({ branchId }: { branchId: string }) {
  const can = usePageAccess();
  const tabs = TABS.filter((t) => t.pages === null || can(...t.pages));
  const [active, setActive] = useState<TabKey>("statement");
  const uid = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const current = tabs.some((t) => t.key === active) ? active : tabs[0].key;

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === current);
    let next = -1;
    if (event.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setActive(tabs[next].key);
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <section className="card" style={{ overflow: "hidden" }}>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Branch records"
        onKeyDown={onKey}
        style={{
          display: "flex",
          gap: 4,
          padding: "0 16px",
          overflowX: "auto",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {tabs.map((t) => {
          const selected = t.key === current;
          return (
            <button
              key={t.key}
              id={`${uid}-tab-${t.key}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${uid}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              style={{
                padding: "14px 12px",
                fontSize: 14,
                fontWeight: selected ? 600 : 500,
                color: selected ? "var(--fg1)" : "var(--fg2)",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${selected ? "var(--brand-indigo)" : "transparent"}`,
                marginBottom: -1,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${current}`}
      >
        {current === "statement" ? (
          <BranchStatementCard branchId={branchId} embedded />
        ) : current === "stock" ? (
          <StockPanel id={branchId} />
        ) : current === "sales" ? (
          <SalesPanel id={branchId} />
        ) : current === "payments" ? (
          <PaymentsPanel id={branchId} />
        ) : current === "customers" ? (
          <CustomersPanel id={branchId} />
        ) : current === "expenses" ? (
          <ExpensesPanel id={branchId} />
        ) : current === "people" ? (
          <PeoplePanel id={branchId} />
        ) : (
          <ActivityPanel id={branchId} />
        )}
      </div>
    </section>
  );
}
