import { Badge } from "@/components/ui/badge";
import type { BranchPaymentStatus } from "@/types/credit-branches/credit-branch";

const STATUS: Record<
  BranchPaymentStatus,
  { color: "amber" | "emerald" | "rose"; label: string }
> = {
  pending: { color: "amber", label: "Awaiting review" },
  approved: { color: "emerald", label: "Approved" },
  rejected: { color: "rose", label: "Rejected" },
};

export function BranchPaymentStatusBadge({
  status,
}: {
  status: BranchPaymentStatus;
}) {
  const { color, label } = STATUS[status];
  return <Badge color={color}>{label}</Badge>;
}
