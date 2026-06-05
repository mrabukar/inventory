"use client";
import { Download, TrendingUp, Package, CreditCard, Truck, Layers } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Button }      from "@/components/ui/button";
import { FilterBtn }   from "@/components/ui/search";
import { StatCard }    from "@/components/ui/stat-card";
import { Card }        from "@/components/ui/card";
import { GroupedBar }  from "@/components/charts/grouped-bar";
import { LineArea }    from "@/components/charts/line-area";
import { SUMMARY, REV_COGS_EXP, NET_PROFIT, MONTHS } from "@/lib/data";
import { fmt }         from "@/lib/utils";

const PNL_ROWS = [
  { lbl: "Revenue",           op: "",  v: 124500, w: 100, c: "var(--brand-indigo)"  },
  { lbl: "Cost of Goods Sold",op: "−", v: 78200,  w: 63,  c: "var(--cost-slate)"    },
  { lbl: "Gross Profit",      op: "=", v: 46300,  w: 37,  c: "var(--brand-teal)"    },
  { lbl: "Operating Expenses",op: "−", v: 12800,  w: 10,  c: "var(--status-amber)"  },
  { lbl: "Net Profit",        op: "=", v: 33500,  w: 27,  c: "var(--brand-violet)"  },
];

function PnL() {
  return (
    <div className="card card-pad">
      <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>P&L Breakdown</h3>
      {PNL_ROWS.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "7px 0" }}>
          <span style={{ width: 180, flexShrink: 0, fontSize: 13, fontWeight: 500 }}>
            <span style={{ color: "var(--fg3)" }}>{r.op} </span>{r.lbl}
          </span>
          <span style={{ flex: 1, height: 14, background: "var(--input-bg)", borderRadius: 4, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: r.w + "%", background: r.c, borderRadius: 4 }} />
          </span>
          <span className="num" style={{ width: 90, textAlign: "right", fontWeight: 600, fontSize: 13, color: i === 4 ? "var(--brand-violet)" : "var(--fg1)" }}>
            {fmt(r.v)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FinancialPage() {
  const s = SUMMARY;
  return (
    <>
      <PageHeader
        title="Financial Summary"
        desc="Revenue, cost, and profit for the selected period"
        action={<Button variant="outline" Icon={Download}>Export</Button>}
      />

      <div className="filterbar">
        <FilterBtn label="Last 6 months" />
        <FilterBtn label="All stores" />
      </div>

      <div className="stat-grid grid-4 mb-16">
        <StatCard icon={TrendingUp} color="indigo"  value={fmt(s.total_revenue)}  label="Total Revenue" />
        <StatCard icon={Package}    color="violet"  value={fmt(s.cogs)}            label="Cost of Goods Sold" valueColor="var(--cost-slate)" />
        <StatCard icon={TrendingUp} color="teal"    value={fmt(s.gross_profit)}   label="Gross Profit" />
        <StatCard icon={CreditCard} color="amber"   value={fmt(s.total_expenses)} label="Total Expenses" />
        <StatCard icon={TrendingUp} color="violet"  value={fmt(s.net_profit)}     label="Net Profit" />
        <StatCard icon={Truck}      color="indigo"  value={fmt(96400)}             label="Stock Capital Invested" />
        <StatCard icon={Layers}     color="teal"    value={fmt(s.current_stock_value)} label="Current Stock Value" />
      </div>

      <div className="mb-16"><PnL /></div>

      <div className="grid-2">
        <Card title="Revenue vs COGS vs Expenses" pad>
          <GroupedBar data={REV_COGS_EXP} />
        </Card>
        <Card title="Net Profit Trend" pad>
          <LineArea values={NET_PROFIT} labels={MONTHS} />
        </Card>
      </div>
    </>
  );
}
