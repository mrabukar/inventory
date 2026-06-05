"use client";
import { useEffect, useState } from "react";

interface Props {
  values: number[];
  labels: string[];
  height?: number;
  color?: string;
}

export function LineArea({ values, labels, height = 240, color = "var(--brand-violet)" }: Props) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 40); return () => clearTimeout(t); }, []);

  const W = 560, H = height, pad = { t: 16, r: 14, b: 28, l: 44 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = Math.max(...values) * 1.15, min = Math.min(0, ...values);
  const x = (i: number) => pad.l + (iw / (values.length - 1)) * i;
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  const area = line + ` L${x(values.length - 1)} ${y(min)} L${x(0)} ${y(min)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {[0, 0.5, 1].map((g, i) => (
        <line key={i} x1={pad.l} x2={W - pad.r} y1={pad.t + ih * g} y2={pad.t + ih * g} stroke="var(--border)" strokeWidth="1" />
      ))}
      <path d={area} fill={color} fillOpacity="0.12" style={{ opacity: on ? 1 : 0, transition: "opacity .8s ease" }} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
        style={{ strokeDasharray: 1400, strokeDashoffset: on ? 0 : 1400, transition: "stroke-dashoffset 1s ease" }} />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color}
          style={{ opacity: on ? 1 : 0, transition: "opacity .5s ease .4s" }} />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fill="var(--fg3)" fontFamily="var(--font-sans)">{l}</text>
      ))}
    </svg>
  );
}
