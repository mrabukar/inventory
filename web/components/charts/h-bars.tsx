"use client";

interface Props<T extends Record<string, string | number>> {
  data: T[];
  valueKey: keyof T & string;
  labelKey: keyof T & string;
  color?: string;
  format?: (v: number) => string;
}

export function HBars<T extends Record<string, string | number>>({
  data,
  valueKey,
  labelKey,
  color = "var(--brand-teal)",
  format,
}: Props<T>) {
  const max = Math.max(...data.map((d) => d[valueKey] as number), 1);

  return (
    <div>
      {data.map((d, i) => {
        const value = d[valueKey] as number;
        const widthPct = max > 0 ? (value / max) * 100 : 0;

        return (
          <div className="hbar-row" key={i}>
            <span className="hb-name" title={String(d[labelKey])}>
              {d[labelKey]}
            </span>
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="hb-val">{format ? format(value) : value}</span>
          </div>
        );
      })}
    </div>
  );
}
