import { LucideIcon, Inbox } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  sub?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, sub }: Props) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
    </div>
  );
}
