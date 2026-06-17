import { formatProductLabel } from "@/lib/products/format";

export function ProductName({
  name,
  model,
}: {
  name: string;
  model?: string | null;
}) {
  return <span className="strong">{formatProductLabel(name, model)}</span>;
}
