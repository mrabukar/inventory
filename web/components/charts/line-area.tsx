"use client";

import { useEffect, useState, type MouseEvent } from "react";

import { fmt } from "@/lib/utils";

interface Props {
  values: number[];
  labels: string[];
  height?: number;
  color?: string;
  valueLabel?: string;
}

function svgX(event: MouseEvent<SVGRectElement>): number | null {
  const svg = event.currentTarget.ownerSVGElement;
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  return pt.matrixTransform(ctm.inverse()).x;
}

export function LineArea({
  values,
  labels,
  height = 240,
  color = "var(--brand-violet)",
  valueLabel = "Net Profit",
}: Props) {
  const [on, setOn] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setOn(true), 40);
    return () => clearTimeout(t);
  }, []);

  if (values.length === 0) return null;

  const W = 560;
  const H = height;
  const pad = { t: 16, r: 14, b: 28, l: 44 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...values, 1) * 1.15;
  const min = Math.min(0, ...values);
  const span = Math.max(values.length - 1, 1);
  const x = (i: number) => pad.l + (iw / span) * i;
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  const area =
    line + ` L${x(values.length - 1)} ${y(min)} L${x(0)} ${y(min)} Z`;

  const tooltipLeft =
    hoverIndex != null ? (x(hoverIndex) / W) * 100 : 0;

  const handlePlotMove = (event: MouseEvent<SVGRectElement>) => {
    const px = svgX(event);
    if (px == null || px < pad.l || px > W - pad.r) {
      setHoverIndex(null);
      return;
    }
    const raw = ((px - pad.l) / iw) * span;
    const i = Math.round(raw);
    setHoverIndex(i >= 0 && i < values.length ? i : null);
  };

  return (
    <div className="chart-wrap">
      {hoverIndex != null && (
        <div
          className="chart-tooltip chart-tooltip--compact"
          style={{ left: `${tooltipLeft}%` }}
          role="tooltip"
        >
          <div className="chart-tooltip-title">{labels[hoverIndex]}</div>
          <div className="chart-tooltip-row">
            <span className="chart-tooltip-dot" style={{ background: color }} />
            <span className="chart-tooltip-label">{valueLabel}</span>
            <span className="chart-tooltip-value num">
              {fmt(values[hoverIndex])}
            </span>
          </div>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="chart-svg"
        style={{ display: "block" }}
      >
        {[0, 0.5, 1].map((g, i) => (
          <line
            key={i}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + ih * g}
            y2={pad.t + ih * g}
            stroke="var(--border)"
            strokeWidth="1"
            pointerEvents="none"
          />
        ))}
        <path
          d={area}
          fill={color}
          fillOpacity="0.12"
          style={{ opacity: on ? 1 : 0, transition: "opacity .8s ease" }}
          pointerEvents="none"
        />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            strokeDasharray: 1400,
            strokeDashoffset: on ? 0 : 1400,
            transition: "stroke-dashoffset 1s ease",
          }}
          pointerEvents="none"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={hoverIndex === i ? 5 : 3}
            fill={color}
            style={{
              opacity: on ? 1 : 0,
              transition: "opacity .5s ease .4s, r .15s ease",
            }}
            pointerEvents="none"
          />
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 9}
            textAnchor="middle"
            fontSize="11"
            fill={hoverIndex === i ? "var(--fg1)" : "var(--fg3)"}
            fontFamily="var(--font-sans)"
            pointerEvents="none"
          >
            {l}
          </text>
        ))}
        <rect
          x={pad.l}
          y={pad.t}
          width={iw}
          height={ih}
          fill="transparent"
          className="chart-hit"
          onMouseMove={handlePlotMove}
          onMouseLeave={() => setHoverIndex(null)}
        />
      </svg>
    </div>
  );
}
