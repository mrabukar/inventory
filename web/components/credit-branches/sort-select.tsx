import { ArrowDownUp } from "lucide-react";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

/** A native select: keyboard and screen-reader friendly, and nothing to maintain. */
export function SortSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <ArrowDownUp className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
