interface Item {
  k: string;
  v: string | number;
  color?: string;
}

export function SummaryBar({ items }: { items: Item[] }) {
  return (
    <div className="summary-bar">
      {items.map((it, i) => (
        <div className="summary-item" key={i}>
          <div className="si-k">{it.k}</div>
          <div className="si-v num" style={it.color ? { color: it.color } : undefined}>
            {it.v}
          </div>
        </div>
      ))}
    </div>
  );
}
