import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

type Color = "indigo" | "teal" | "violet" | "amber" | "emerald" | "rose";

const TINTS: Record<Color, [string, string]> = {
  indigo: ["var(--tint-indigo)", "var(--brand-indigo)"],
  teal: ["var(--tint-teal)", "var(--brand-teal)"],
  violet: ["var(--tint-violet)", "var(--brand-violet)"],
  amber: ["var(--tint-amber)", "var(--status-amber)"],
  emerald: ["var(--tint-emerald)", "var(--status-emerald)"],
  rose: ["var(--tint-rose)", "var(--status-rose)"],
};

interface Props {
  icon: LucideIcon;
  color?: Color;
  value: string | number;
  label: string;
  trend?: string;
  trendDir?: "up" | "down";
  valueColor?: string;
}

export function StatCard({
  icon: Icon,
  color = "indigo",
  value,
  label,
  trend,
  trendDir = "up",
  valueColor,
}: Props) {
  const [bg, fg] = TINTS[color] ?? TINTS.indigo;
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-ic" style={{ background: bg, color: fg }}>
          <Icon size={20} />
        </div>
        {trend != null && (
          <span className={`trend ${trendDir === "down" ? "trend-dn" : "trend-up"}`}>
            {trendDir === "down" ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {trend}
          </span>
        )}
      </div>
      <div className="stat-val num" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}
