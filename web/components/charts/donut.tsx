"use client";
import { useEffect, useState } from "react";

interface Slice { label: string; value: number; color: string; }

interface Props {
  data: Slice[];
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
}

export function Donut({ data, centerLabel, centerValue, height = 200 }: Props) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const t = setTimeout(() => setOn(true), 40);
    return () => clearTimeout(t);
  }, [data]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 70, r = 46, C = 90;
  const singleSlice = data.length === 1 && total > 0;
  let acc = 0;

  const segs = singleSlice
    ? []
    : data.map((d) => {
        const frac = total > 0 ? d.value / total : 0;
        const a0 = acc * 2 * Math.PI - Math.PI / 2;
        acc += frac;
        const a1 = acc * 2 * Math.PI - Math.PI / 2;
        const large = frac > 0.5 ? 1 : 0;
        const p = (ang: number, rad: number): [number, number] => [
          C + rad * Math.cos(ang),
          C + rad * Math.sin(ang),
        ];
        const [x0, y0] = p(a0, R);
        const [x1, y1] = p(a1, R);
        const [x2, y2] = p(a1, r);
        const [x3, y3] = p(a0, r);
        return {
          path: `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`,
          color: d.color,
          label: d.label,
        };
      });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 180 180" width={height} height={height}
        style={{ opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(.9)", transition: "opacity .5s ease, transform .5s ease" }}>
        {singleSlice ? (
          <>
            <circle cx={C} cy={C} r={R} fill={data[0].color} />
            <circle cx={C} cy={C} r={r} fill="var(--surface)" />
          </>
        ) : (
          segs.map((s, i) => <path key={i} d={s.path} fill={s.color} />)
        )}
        {centerValue != null && (
          <text x="90" y="84" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--fg1)" fontFamily="var(--font-sans)">{centerValue}</text>
        )}
        {centerLabel && (
          <text x="90" y="102" textAnchor="middle" fontSize="11" fill="var(--fg3)" fontFamily="var(--font-sans)">{centerLabel}</text>
        )}
      </svg>
      <div className="legend">
        {data.map((d, i) => (
          <span className="li" key={i}>
            <span className="dot" style={{ background: d.color }} />{d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
