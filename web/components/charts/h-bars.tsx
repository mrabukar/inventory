"use client";
import { useEffect, useState } from "react";

interface Props<T extends Record<string, string | number>> {
  data: T[];
  valueKey: keyof T & string;
  labelKey: keyof T & string;
  color?: string;
  format?: (v: number) => string;
}

export function HBars<T extends Record<string, string | number>>({
  data, valueKey, labelKey, color = "var(--brand-teal)", format,
}: Props<T>) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 40); return () => clearTimeout(t); }, []);

  const max = Math.max(...data.map((d) => d[valueKey] as number));

  return (
    <div>
      {data.map((d, i) => (
        <div className="hbar-row" key={i}>
          <span className="hb-name" title={String(d[labelKey])}>{d[labelKey]}</span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{ width: on ? ((d[valueKey] as number) / max) * 100 + "%" : 0, background: color, transition: "width .7s ease" }}
            />
          </span>
          <span className="hb-val">
            {format ? format(d[valueKey] as number) : d[valueKey]}
          </span>
        </div>
      ))}
    </div>
  );
}
