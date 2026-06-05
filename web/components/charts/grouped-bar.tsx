"use client";
import { useEffect, useState } from "react";

interface DataPoint { m: string; rev: number; cogs: number; exp: number; }

export function GroupedBar({ data, height = 240 }: { data: DataPoint[]; height?: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 40); return () => clearTimeout(t); }, []);

  const W = 560, H = height, pad = { t: 16, r: 12, b: 28, l: 44 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = Math.max(...data.flatMap((d) => [d.rev, d.cogs, d.exp])) * 1.1;
  const groupW = iw / data.length, barW = Math.min(16, groupW / 4);
  const series: [keyof DataPoint, string][] = [
    ["rev",  "var(--brand-indigo)"],
    ["cogs", "var(--cost-slate)"],
    ["exp",  "var(--status-amber)"],
  ];
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {[0, 0.5, 1].map((g, i) => (
          <line key={i} x1={pad.l} x2={W - pad.r} y1={pad.t + ih * g} y2={pad.t + ih * g} stroke="var(--border)" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const gx = pad.l + groupW * i + groupW / 2;
          return series.map(([k, c], j) => {
            const bx = gx + (j - 1) * (barW + 3) - barW / 2;
            const bh = on ? ((d[k] as number) / max) * ih : 0;
            return (
              <rect key={k} x={bx} y={pad.t + ih - bh} width={barW} height={bh} rx="2.5" fill={c}
                style={{ transition: "height .6s ease, y .6s ease" }} />
            );
          });
        })}
        {data.map((d, i) => (
          <text key={i} x={pad.l + groupW * i + groupW / 2} y={H - 9} textAnchor="middle"
            fontSize="11" fill="var(--fg3)" fontFamily="var(--font-sans)">{d.m}</text>
        ))}
        {[0, 0.5, 1].map((g, i) => (
          <text key={i} x={pad.l - 8} y={pad.t + ih * (1 - g) + 4} textAnchor="end"
            fontSize="10" fill="var(--fg3)" fontFamily="var(--font-mono)">
            {"$" + Math.round((max * g) / 1000) + "k"}
          </text>
        ))}
      </svg>
      <div className="legend">
        <span className="li"><span className="dot" style={{ background: "var(--brand-indigo)" }} />Revenue</span>
        <span className="li"><span className="dot" style={{ background: "var(--cost-slate)"   }} />COGS</span>
        <span className="li"><span className="dot" style={{ background: "var(--status-amber)" }} />Expenses</span>
      </div>
    </div>
  );
}
