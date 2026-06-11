import { XCircle } from "lucide-react";
import { DashboardLoadingSkeleton } from "./loading-skeleton";

export function DashboardLoading() {
  return <DashboardLoadingSkeleton />;
}

export function DashboardError({ message }: { message: string }) {
  return (
    <div className="alert-error" style={{ marginTop: 16 }}>
      <XCircle size={16} />
      {message}
    </div>
  );
}
