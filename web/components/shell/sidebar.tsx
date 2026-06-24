"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible } from "radix-ui";
import {
  Building2,
  ChevronDown,
  FileBarChart2,
  LayoutDashboard,
  Package,
  Layers,
  Receipt,
  ShoppingCart,
  ShoppingBag,
  Tag,
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
  Warehouse,
} from "lucide-react";

import { LogoMark } from "@/components/logo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Role } from "@/lib/types";
import { fetchOrganizationLogoBlob } from "@/service/upload";
import { useAppStore } from "@/store/app";

interface NavLinkItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  match?: "exact" | "prefix";
}

interface NavGroupItem {
  type: "group";
  label: string;
  icon: React.ElementType;
  children: NavLinkItem[];
}

type AdminNavEntry = NavLinkItem | NavGroupItem;

const SUPER_ADMIN_NAV: NavLinkItem[] = [
  {
    href: "/super-admin",
    label: "Platform",
    icon: LayoutDashboard,
    match: "exact",
  },
  {
    href: "/super-admin/organizations",
    label: "Organizations",
    icon: Building2,
  },
];

function buildAdminNav(hasStores: boolean): AdminNavEntry[] {
  const nav: AdminNavEntry[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      type: "group",
      label: "Purchase",
      icon: ShoppingBag,
      children: [
        { href: "/categories", label: "Categories", icon: Tag },
        { href: "/products", label: "Products", icon: Package },
        { href: "/purchases", label: "Purchases", icon: Receipt },
        ...(hasStores
          ? [{ href: "/supply", label: "Distribute to Store", icon: Truck }]
          : []),
      ],
    },
  ];

  nav.push({
    type: "group",
    label: "Stock",
    icon: Boxes,
    children: [
      { href: "/warehouse", label: "Warehouse", icon: Warehouse },
      { href: "/inventory", label: "Inventory", icon: Layers },
      { href: "/stock-report", label: "Stock Report", icon: FileBarChart2 },
    ],
  });

  nav.push(
    { href: "/sales", label: "Sales", icon: ShoppingCart },
    { href: "/expenses", label: "Expenses", icon: CreditCard },
  );

  if (hasStores) {
    nav.push({ href: "/stores", label: "Stores", icon: Store });
  } else {
    nav.push({
      href: "/submit-sale",
      label: "Submit Sale",
      icon: PlusCircle,
    });
  }

  nav.push(
    {
      type: "group",
      label: "Administration",
      icon: ShieldCheck,
      children: [
        { href: "/users", label: "Users", icon: Users },
        { href: "/audit", label: "Audit Log", icon: ClipboardList },
        {
          href: "/settings/organization",
          label: "Organization",
          icon: Building2,
        },
      ],
    },
    { href: "/financial", label: "Financial Summary", icon: TrendingUp },
  );

  return nav;
}

const MANAGER_NAV: NavLinkItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/submit-sale", label: "Submit Sale", icon: PlusCircle },
  { href: "/my-stock", label: "My Stock", icon: Package },
  { href: "/sales-history", label: "Sales History", icon: History },
];

function isNavGroup(entry: AdminNavEntry): entry is NavGroupItem {
  return "type" in entry && entry.type === "group";
}

function isRouteActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix" = "prefix",
): boolean {
  if (match === "exact") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, children: NavLinkItem[]): boolean {
  return children.some((child) =>
    isRouteActive(pathname, child.href, child.match),
  );
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
  const active = isRouteActive(pathname, item.href, item.match);

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
  const active = isRouteActive(pathname, item.href, item.match);

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

function SidebarBrand({
  role,
  collapsed,
}: {
  role: Role;
  collapsed: boolean;
}) {
  const organizationName = useAppStore((s) => s.user?.organizationName ?? null);
  const organizationLogoKey = useAppStore(
    (s) => s.user?.organizationLogoKey ?? null,
  );
  const organizationLogoUpdatedAt = useAppStore(
    (s) => s.user?.organizationLogoUpdatedAt ?? null,
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const hasLogo = Boolean(organizationLogoKey);

  useEffect(() => {
    if (role === "super_admin" || !hasLogo) {
      setLogoUrl(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    void fetchOrganizationLogoBlob(
      "current",
      undefined,
      organizationLogoUpdatedAt,
    ).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setLogoUrl(url);
    });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [role, hasLogo, organizationLogoUpdatedAt]);

  if (role === "super_admin") {
    return (
      <div className="sb-logo">
        <LogoMark size={28} />
        {!collapsed && <span className="wm">inventory</span>}
      </div>
    );
  }

  const displayName = organizationName ?? "Organization";

  return (
    <div className="sb-logo">
      {hasLogo && logoUrl ? (
        <div className="sb-org-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" />
        </div>
      ) : hasLogo ? (
        <div className="sb-org-logo sb-org-logo--loading" aria-hidden />
      ) : (
        <LogoMark size={28} />
      )}
      {!collapsed && (
        <span className="wm" title={displayName}>
          {displayName}
        </span>
      )}
    </div>
  );
}

interface Props {
  role: Role;
  collapsed: boolean;
  storeName?: string | null;
  hasStores?: boolean | null;
}

export function Sidebar({
  role,
  collapsed,
  storeName,
  hasStores = true,
}: Props) {
  const pathname = usePathname();
  const adminNav = buildAdminNav(hasStores !== false);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <SidebarBrand role={role} collapsed={collapsed} />

      <nav className="sb-nav">
        {!collapsed && (
          <div className="sb-section">
            {role === "super_admin"
              ? "Platform"
              : role === "admin"
                ? "Operations"
                : "My Store"}
          </div>
        )}
        {role === "super_admin"
          ? SUPER_ADMIN_NAV.map((item) => (
              <SidebarNavLink key={item.href} item={item} pathname={pathname} />
            ))
          : role === "admin"
            ? adminNav.map((entry) =>
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
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                />
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
