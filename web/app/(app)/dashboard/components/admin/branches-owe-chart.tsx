"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { fmt } from "@/lib/utils";
import { limitedUserMayOpen } from "@/lib/limited-pages";
import { useAppStore } from "@/store/app";
import type { CreditBranch } from "@/types/credit-branches/credit-branch";

const PAID = "var(--brand-teal-600)";
const OWED = "var(--status-rose)";

interface Props {
  branches: CreditBranch[];
  isLoading: boolean;
  isError: boolean;
}

/** What a branch was charged, how much of it is paid and how much it still owes. */
function toRow(branch: CreditBranch) {
  const charged = branch.totalCredited - branch.totalReturned;
  return {
    id: branch.id,
    name: branch.name,
    charged,
    paid: branch.totalPaid,
    pending: branch.totalPending,
    balance: branch.balance,
  };
}

type Row = ReturnType<typeof toRow>;

// Styled inline so the card never depends on a stylesheet reload.
const ink1 = "var(--fg1)";
const ink2 = "var(--fg2)";
const ink3 = "var(--fg3)";
const mono = "var(--font-mono)";
const AXIS_H = 220;

const st: Record<string, CSSProperties> = {
  summary: {
    display: "flex",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: "4px 10px",
    marginBottom: 20,
  },
  total: { fontSize: 24, fontWeight: 700, color: ink1, fontFamily: mono },
  sub: { fontSize: 13, color: ink2 },
  legend: {
    marginLeft: "auto",
    display: "flex",
    gap: 16,
    fontSize: 12,
    color: ink2,
  },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  body: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 40,
    alignItems: "start",
  },
  chart: { display: "flex", gap: 10, minWidth: 0 },
  axis: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: "26px 0 30px",
    fontSize: 11,
    fontFamily: mono,
    color: ink3,
  },
  plot: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    justifyContent: "space-evenly",
    gap: 6,
  },
  col: {
    position: "relative",
    flex: "1 1 0",
    maxWidth: 150,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    color: "inherit",
    textDecoration: "none",
  },
  value: {
    height: 22,
    lineHeight: "22px",
    fontSize: 12,
    fontWeight: 600,
    color: ink1,
    fontFamily: mono,
  },
  stack: {
    width: "100%",
    maxWidth: 64,
    height: AXIS_H,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    gap: 2,
    borderBottom: "1px solid var(--border)",
  },
  name: {
    maxWidth: "100%",
    height: 26,
    lineHeight: "26px",
    fontSize: 12,
    color: ink2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tooltip: { left: "50%", top: 28, minWidth: 190, zIndex: 10 },
  list: { display: "flex", flexDirection: "column", minWidth: 0 },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 0",
    borderBottom: "1px solid var(--border)",
    color: "inherit",
    textDecoration: "none",
  },
  itemName: {
    fontSize: 14,
    fontWeight: 600,
    color: ink1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  itemSub: { marginTop: 2, fontSize: 12, color: ink2 },
  itemOwes: {
    fontSize: 15,
    fontWeight: 600,
    color: ink1,
    fontFamily: mono,
    whiteSpace: "nowrap",
  },
};

export function BranchesOweChart({ branches, isLoading, isError }: Props) {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const mayOpen =
    user?.role !== "limited" ||
    limitedUserMayOpen("/credit-branches", user.allowedPages);

  const rows = branches.map(toRow).sort((a, b) => b.balance - a.balance);
  // A branch that paid ahead owes nothing; it does not reduce what others owe.
  const owed = rows.reduce((sum, r) => sum + Math.max(r.balance, 0), 0);
  const charged = rows.reduce((sum, r) => sum + r.charged, 0);
  const scale = Math.max(...rows.map((r) => Math.max(r.charged, r.paid)), 1);

  return (
    <div className="mb-16">
      <Card
        title="Branches Owe"
        link={mayOpen ? "View all" : undefined}
        onLink={() => router.push("/credit-branches")}
        pad
      >
        {isLoading ? (
          <span
            className="dt-skeleton"
            aria-hidden="true"
            style={{ width: "100%", maxWidth: "none", height: 240 }}
          />
        ) : isError ? (
          <EmptyState
            title="Could not load branch balances"
            sub="Refresh the page to try again."
          />
        ) : charged <= 0 && owed === 0 ? (
          <EmptyState
            title="Nothing credited yet"
            sub="What each branch owes shows here once you credit stock to it."
          />
        ) : (
          <>
            <div style={st.summary}>
              <span style={st.total}>{fmt(owed)}</span>
              <span style={st.sub}>
                still owed of {fmt(charged)} credited, all time
              </span>
              <div style={st.legend}>
                <span style={st.legendItem}>
                  <Swatch color={PAID} />
                  Paid
                </span>
                <span style={st.legendItem}>
                  <Swatch color={OWED} />
                  Owes
                </span>
              </div>
            </div>
            <div style={st.body}>
              <div style={st.chart}>
                <div style={st.axis} aria-hidden="true">
                  {[1, 0.5, 0].map((g) => (
                    <span key={g}>{fmt(Math.round(scale * g))}</span>
                  ))}
                </div>
                <div style={st.plot}>
                  {rows.map((row) => (
                    <OweColumn
                      key={row.id}
                      row={row}
                      scale={scale}
                      href={mayOpen ? `/credit-branches/${row.id}` : undefined}
                    />
                  ))}
                </div>
              </div>
              <div style={st.list}>
                {rows.map((row) => (
                  <BranchLine
                    key={row.id}
                    row={row}
                    href={mayOpen ? `/credit-branches/${row.id}` : undefined}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 3,
        background: color,
        display: "inline-block",
      }}
    />
  );
}

function BranchLine({ row, href }: { row: Row; href?: string }) {
  const body = (
    <>
      <span style={{ minWidth: 0 }}>
        <div style={st.itemName} title={row.name}>
          {row.name}
        </div>
        <div style={st.itemSub}>
          {fmt(row.paid)} paid of {fmt(row.charged)}
        </div>
      </span>
      <span style={st.itemOwes}>{fmt(Math.max(row.balance, 0))}</span>
    </>
  );
  return href ? (
    <Link href={href} style={st.item}>
      {body}
    </Link>
  ) : (
    <div style={st.item}>{body}</div>
  );
}

function OweColumn({
  row,
  scale,
  href,
}: {
  row: Row;
  scale: number;
  href?: string;
}) {
  const [open, setOpen] = useState(false);
  const owed = Math.max(row.balance, 0);
  const paidPct = (row.paid / scale) * 100;
  const owedPct = (owed / scale) * 100;

  const details: { label: string; value: number; color?: string }[] = [
    { label: "Credited", value: row.charged },
    { label: "Paid", value: row.paid, color: PAID },
    { label: "Owes", value: owed, color: OWED },
  ];
  if (row.balance < 0) {
    details.push({ label: "Paid in advance", value: -row.balance });
  }
  if (row.pending > 0) {
    details.push({ label: "Waiting for approval", value: row.pending });
  }

  const bar = (height: number, color: string, top: boolean): CSSProperties => ({
    display: "block",
    width: "100%",
    minHeight: 3,
    height: `${height}%`,
    background: color,
    borderRadius: top ? "4px 4px 0 0" : 0,
  });

  const body = (
    <>
      <span style={st.value}>{fmt(owed)}</span>
      <span style={st.stack}>
        {owed > 0 ? <span style={bar(owedPct, OWED, true)} /> : null}
        {row.paid > 0 ? <span style={bar(paidPct, PAID, owed <= 0)} /> : null}
      </span>
      <span style={st.name} title={row.name}>
        {row.name}
      </span>
      {open ? (
        <span
          className="chart-tooltip"
          style={st.tooltip}
          role="tooltip"
        >
          <span className="chart-tooltip-title" style={{ display: "block" }}>
            {row.name}
          </span>
          {details.map((d) => (
            <span className="chart-tooltip-row" key={d.label}>
              <span
                className="chart-tooltip-dot"
                style={{ background: d.color ?? "transparent" }}
              />
              <span className="chart-tooltip-label">{d.label}</span>
              <span className="chart-tooltip-value num">{fmt(d.value)}</span>
            </span>
          ))}
        </span>
      ) : null}
    </>
  );

  const handlers = {
    style: st.col,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };

  return href ? (
    <Link href={href} {...handlers}>
      {body}
    </Link>
  ) : (
    <div tabIndex={0} {...handlers}>
      {body}
    </div>
  );
}
