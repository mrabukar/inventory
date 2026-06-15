"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible } from "radix-ui";
import {
  ChevronDown,
  FileBarChart2,
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  ShoppingBag,
  Truck,
  CreditCard,
  TrendingUp,
  Users,
  ClipboardList,
  PlusCircle,
  History,
  ShieldCheck,
  Store,
  Boxes,
} from "lucide-react";

import { LogoMark } from "@/components/logo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Role } from "@/lib/types";

interface NavLinkItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavGroupItem {
  type: "group";
  label: string;
  icon: React.ElementType;
  children: NavLinkItem[];
}

type AdminNavEntry = NavLinkItem | NavGroupItem;

const ADMIN_NAV: AdminNavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    type: "group",
    label: "Purchase",
    icon: ShoppingBag,
    children: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/supply", label: "Stock Supply", icon: Truck },
    ],
  },
  {
    type: "group",
    label: "Stock",
    icon: Boxes,
    children: [
      { href: "/inventory", label: "Inventory", icon: Layers },
      { href: "/stock-report", label: "Stock Report", icon: FileBarChart2 },
    ],
  },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/financial", label: "Financial Summary", icon: TrendingUp },
];

const MANAGER_NAV: NavLinkItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/submit-sale", label: "Submit Sale", icon: PlusCircle },
  { href: "/my-stock", label: "My Stock", icon: Package },
  { href: "/sales-history", label: "Sales History", icon: History },
];

function isNavGroup(entry: AdminNavEntry): entry is NavGroupItem {
  return "type" in entry && entry.type === "group";
}

function isRouteActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, children: NavLinkItem[]): boolean {
  return children.some((child) => isRouteActive(pathname, child.href));
}

interface SidebarNavLinkProps {
  item: NavLinkItem;
  pathname: string;
  className?: string;
  onNavigate?: () => void;
}

function SidebarNavTreeRow({
  item,
  pathname,
  linkClassName,
  onNavigate,
}: {
  item: NavLinkItem;
  pathname: string;
  linkClassName: string;
  onNavigate?: () => void;
}) {
  const active = isRouteActive(pathname, item.href);

  return (
    <div className="nav-tree-row">
      <span
        className={`nav-tree-node ${active ? "is-active" : ""}`}
        aria-hidden
      />
      <span className="nav-tree-tick" aria-hidden />
      <SidebarNavLink
        item={item}
        pathname={pathname}
        className={linkClassName}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function SidebarNavLink({
  item,
  pathname,
  className = "",
  onNavigate,
}: SidebarNavLinkProps) {
  const Icon = item.icon;
  const active = isRouteActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={`nav-item ${active ? "active" : ""} ${className}`.trim()}
      title={item.label}
      onClick={onNavigate}
    >
      <Icon size={18} />
      <span className="nav-label">{item.label}</span>
      {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
    </Link>
  );
}

interface SidebarNavGroupProps {
  group: NavGroupItem;
  pathname: string;
  collapsed: boolean;
}

function SidebarNavGroupExpanded({
  group,
  pathname,
  defaultOpen,
}: {
  group: NavGroupItem;
  pathname: string;
  defaultOpen: boolean;
}) {
  const Icon = group.icon;
  const childActive = isGroupActive(pathname, group.children);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="nav-group">
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className={`nav-item nav-group-trigger ${childActive ? "nav-group--active" : ""} ${open ? "nav-group--open" : ""}`}
        >
          <Icon size={18} />
          <span className="nav-label">{group.label}</span>
          <ChevronDown size={16} className="nav-group-chevron" aria-hidden />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className="nav-group-children">
        <div className="nav-group-panel nav-tree">
          {group.children.map((child) => (
            <SidebarNavTreeRow
              key={child.href}
              item={child}
              pathname={pathname}
              linkClassName="nav-subitem"
            />
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function SidebarNavGroup({ group, pathname, collapsed }: SidebarNavGroupProps) {
  const Icon = group.icon;
  const childActive = isGroupActive(pathname, group.children);
  const activeChildHref =
    group.children.find((child) => isRouteActive(pathname, child.href))?.href ??
    "";
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  if (collapsed) {
    return (
      <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`nav-item ${childActive ? "nav-group--active" : ""}`}
            title={group.label}
          >
            <Icon size={18} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="nav-flyout"
        >
          <div className="nav-flyout-title">{group.label}</div>
          <div className="nav-flyout-panel nav-tree">
            {group.children.map((child) => (
              <SidebarNavTreeRow
                key={child.href}
                item={child}
                pathname={pathname}
                linkClassName="nav-flyout-item"
                onNavigate={() => setFlyoutOpen(false)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <SidebarNavGroupExpanded
      key={activeChildHref || "inactive"}
      group={group}
      pathname={pathname}
      defaultOpen={childActive}
    />
  );
}

interface Props {
  role: Role;
  collapsed: boolean;
  storeName?: string | null;
}

export function Sidebar({ role, collapsed, storeName }: Props) {
  const pathname = usePathname();

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
        {role === "admin"
          ? ADMIN_NAV.map((entry) =>
              isNavGroup(entry) ? (
                <SidebarNavGroup
                  key={entry.label}
                  group={entry}
                  pathname={pathname}
                  collapsed={collapsed}
                />
              ) : (
                <SidebarNavLink
                  key={entry.href}
                  item={entry}
                  pathname={pathname}
                />
              ),
            )
          : MANAGER_NAV.map((item) => (
              <SidebarNavLink key={item.href} item={item} pathname={pathname} />
            ))}
      </nav>

      {/* <div className="sb-foot">
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
      </div> */}
    </aside>
  );
}
