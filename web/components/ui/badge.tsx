import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

type Color = "indigo" | "teal" | "violet" | "emerald" | "amber" | "rose" | "slate";

interface Props {
  color?: Color;
  children: React.ReactNode;
  showAlert?: boolean;
}

export function Badge({ color = "slate", children, showAlert }: Props) {
  return (
    <span className={cn("badge", `badge-${color}`)}>
      {showAlert && <AlertTriangle size={12} />}
      {children}
    </span>
  );
}

const CATEGORY_COLORS: Color[] = ["indigo", "teal", "violet", "amber"];

export function CategoryBadge({ cat }: { cat: string }) {
  const index =
    Math.abs(cat.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) %
    CATEGORY_COLORS.length;
  return <Badge color={CATEGORY_COLORS[index]}>{cat}</Badge>;
}

export function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  if (qty <= 0) return <Badge color="rose">Out</Badge>;
  if (qty <= threshold) return <Badge color="amber" showAlert>Low</Badge>;
  return <Badge color="emerald">OK</Badge>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge color={active ? "emerald" : "rose"}>{active ? "Active" : "Inactive"}</Badge>;
}

export function SaleStatusBadge({ status }: { status: "active" | "corrected" }) {
  return (
    <Badge color={status === "corrected" ? "amber" : "emerald"}>
      {status === "corrected" ? "Corrected" : "Active"}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <Badge color={isAdmin ? "indigo" : "teal"}>
      {isAdmin ? "Admin" : "Branch Manager"}
    </Badge>
  );
}
