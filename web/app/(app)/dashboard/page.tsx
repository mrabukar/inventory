"use client";
import { useAppStore } from "@/store/app";
import { AdminDashboard } from "./admin-dashboard";
import { ManagerDashboard } from "./manager-dashboard";

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);
  if (!user) return null;
  return user.role === "admin" || user.role === "limited" ? (
    <AdminDashboard />
  ) : (
    <ManagerDashboard user={user} />
  );
}
