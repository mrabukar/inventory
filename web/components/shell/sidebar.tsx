"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  Truck,
  CreditCard,
  TrendingUp,
  Users,
  ClipboardList,
  PlusCircle,
  History,
  ShieldCheck,
  Store,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  // { href: "/inventory", label: "Inventory",          icon: Layers, badge: 7 },
  { href: "/inventory", label: "Inventory", icon: Layers },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/supply", label: "Stock Supply", icon: Truck },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/financial", label: "Financial Summary", icon: TrendingUp },
];

const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/submit-sale", label: "Submit Sale", icon: PlusCircle },
  { href: "/my-stock", label: "My Stock", icon: Package },
  { href: "/sales-history", label: "Sales History", icon: History },
];

interface Props {
  role: Role;
  collapsed: boolean;
  storeName?: string | null;
}

export function Sidebar({ role, collapsed, storeName }: Props) {
  const pathname = usePathname();
  const nav = role === "admin" ? ADMIN_NAV : MANAGER_NAV;

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sb-logo">
        <LogoMark size={28} />
        {!collapsed && <span className="wm">inventory</span>}
      </div>

      <nav className="sb-nav">
        {!collapsed && (
          <div className="sb-section">
            {role === "admin" ? "Operations" : "My Store"}
          </div>
        )}
        {nav.map((n) => {
          const Icon = n.icon;
          const active =
            pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-item ${active ? "active" : ""}`}
              title={n.label}
            >
              <Icon size={18} />
              <span className="nav-label">{n.label}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="sb-foot">
        <div className="role-chip">
          {role === "admin" ? (
            <>
              <ShieldCheck size={15} style={{ color: "var(--fg3)" }} />
              Admin · Company-wide
            </>
          ) : (
            <>
              <Store size={15} style={{ color: "var(--fg3)" }} />
              {storeName ?? "Branch Manager"}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
