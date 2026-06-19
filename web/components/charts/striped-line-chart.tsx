"use client";

import { useMemo, useState, type MouseEvent } from "react";

import { cn } from "@/lib/utils";

export interface StripedLineSeries {
  values: number[];
  color: string;
  label: string;
  formatValue?: (value: number) => string;
}

interface Props {
  labels: string[];
  series: StripedLineSeries[];
  height?: number;
  className?: string;
  legendClassName?: string;
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

function formatAxisDate(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatTickValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function niceStep(max: number, targetTicks = 5): number {
  const rough = max / Math.max(targetTicks - 1, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  const niceResidual =
    residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
}

function buildYScale(allValues: number[]) {
  const dataMax = Math.max(...allValues, 0);
  const step = niceStep(Math.max(dataMax, 1));
  const max = Math.max(step * 4, step);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return { min: 0, max: ticks[ticks.length - 1] ?? step, ticks };
}

function labelStep(count: number): number {
  if (count <= 8) return 1;
  if (count <= 16) return 2;
  if (count <= 31) return 3;
  return Math.ceil(count / 10);
}

export function StripedLineChart({
  labels,
  series,
  height = 300,
  className,
  legendClassName,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const pointCount = series[0]?.values.length ?? 0;

  const yScale = useMemo(() => {
    const allValues = series.flatMap((s) => s.values);
    return buildYScale(allValues);
  }, [series]);

  if (pointCount === 0 || series.length === 0) return null;

  const plotLabels =
    labels.length === pointCount
      ? labels
      : Array.from({ length: pointCount }, (_, i) => labels[i] ?? "");

  const W = 640;
  const H = height;
  const pad = { t: 16, r: 20, b: 48, l: 48 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const { min, max, ticks } = yScale;
  const span = Math.max(pointCount - 1, 1);
  const x = (i: number) => pad.l + (iw / span) * i;
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;

  const lines = series.map((s) => {
    const values = pointCount === 1 ? [s.values[0], s.values[0]] : s.values;
    const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
    return { ...s, path, values, pts };
  });

  const step = labelStep(pointCount);
  const tooltipLeft = hoverIndex != null ? (x(hoverIndex) / W) * 100 : 0;
  const formatValue = formatTickValue;
  const axisBottom = pad.t + ih;

  const handlePlotMove = (event: MouseEvent<SVGRectElement>) => {
    const px = svgX(event);
    if (px == null || px < pad.l || px > W - pad.r) {
      setHoverIndex(null);
      return;
    }
    const raw = ((px - pad.l) / iw) * span;
    const i = Math.round(raw);
    setHoverIndex(i >= 0 && i < pointCount ? i : null);
  };

  return (
    <div className={cn("striped-line-chart overflow-visible", className)}>
      <div className="chart-wrap striped-line-chart__plot">
        {hoverIndex != null && (
          <div
            className="chart-tooltip chart-tooltip--compact"
            style={{ left: `${tooltipLeft}%` }}
            role="tooltip"
          >
            <div className="chart-tooltip-title">
              {formatAxisDate(plotLabels[hoverIndex])}
            </div>
            {lines.map((line) => {
              const format = line.formatValue ?? formatValue;
              return (
                <div key={line.label} className="chart-tooltip-row">
                  <span
                    className="chart-tooltip-dot"
                    style={{ background: line.color }}
                  />
                  <span className="chart-tooltip-label">{line.label}</span>
                  <span className="chart-tooltip-value num">
                    {format(line.values[hoverIndex])}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="chart-svg multi-line-chart__svg"
          style={{ display: "block", overflow: "visible" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {ticks.map((tick) => {
            const ty = y(tick);
            return (
              <line
                key={`grid-${tick}`}
                x1={pad.l}
                x2={W - pad.r}
                y1={ty}
                y2={ty}
                className="multi-line-chart__grid"
                pointerEvents="none"
              />
            );
          })}

          <line
            x1={pad.l}
            x2={pad.l}
            y1={pad.t}
            y2={axisBottom}
            className="multi-line-chart__axis"
            pointerEvents="none"
          />
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={axisBottom}
            y2={axisBottom}
            className="multi-line-chart__axis"
            pointerEvents="none"
          />

          {ticks.map((tick) => (
            <text
              key={`y-label-${tick}`}
              x={pad.l - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="multi-line-chart__tick"
              pointerEvents="none"
            >
              {formatTickValue(tick)}
            </text>
          ))}

          {lines.map((line) => (
            <path
              key={`line-${line.label}`}
              d={line.path}
              fill="none"
              stroke={line.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              pointerEvents="none"
            />
          ))}

          {lines.map((line) =>
            line.pts.map((p, i) => {
              if (pointCount === 1 && i === 1) return null;
              const active = hoverIndex === i;
              return (
                <circle
                  key={`${line.label}-${i}`}
                  cx={p[0]}
                  cy={p[1]}
                  r={active ? 5.5 : 4.5}
                  fill={line.color}
                  stroke="var(--surface)"
                  strokeWidth="2"
                  pointerEvents="none"
                />
              );
            }),
          )}

          {plotLabels.map((label, i) =>
            i % step !== 0 && i !== pointCount - 1 ? null : (
              <text
                key={`x-label-${i}`}
                x={x(i)}
                y={H - 14}
                textAnchor="middle"
                className="multi-line-chart__tick"
                fill={hoverIndex === i ? "var(--fg1)" : undefined}
                pointerEvents="none"
              >
                {formatAxisDate(label)}
              </text>
            ),
          )}

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

      <div
        className={cn(
          "legend striped-line-chart__legend flex flex-wrap justify-center gap-x-4 gap-y-2",
          legendClassName,
        )}
      >
        {series.map((line) => (
          <div key={line.label} className="li multi-line-chart__legend-item">
            <svg
              width="32"
              height="12"
              viewBox="0 0 32 12"
              aria-hidden="true"
              className="multi-line-chart__legend-mark"
            >
              <line
                x1="0"
                y1="6"
                x2="32"
                y2="6"
                stroke={line.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="16"
                cy="6"
                r="4"
                fill={line.color}
                stroke="var(--surface)"
                strokeWidth="1.5"
              />
            </svg>
            <span>{line.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
