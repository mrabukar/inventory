import { XCircle } from "lucide-react";

export function DashboardLoading() {
  return <div className="muted" style={{ padding: "24px 0" }}>Loading dashboard…</div>;
}

export function DashboardError({ message }: { message: string }) {
  return (
    <div className="alert-error" style={{ marginTop: 16 }}>
      <XCircle size={16} />
      {message}
    </div>
  );
}
