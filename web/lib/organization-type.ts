/**
 * An organization is one of three kinds:
 * - stores: branch managers sell from their stores;
 * - direct: the admin sells from the organization's own stock;
 * - credit: the organization credits stock to branches and sells nothing
 *   itself; only the branches sell.
 */
export type OrganizationType = "stores" | "direct" | "credit";

export const ORGANIZATION_TYPE_OPTIONS: {
  value: OrganizationType;
  label: string;
  description: string;
}[] = [
  {
    value: "stores",
    label: "Stores",
    description:
      "Branch managers sell from their own stores. Stock is distributed from the warehouse to each store.",
  },
  {
    value: "direct",
    label: "Direct sales",
    description:
      "The admin sells straight from the organization's stock. No stores or credit branches.",
  },
  {
    value: "credit",
    label: "Credit branches",
    description:
      "Stock is credited to branches, which sell it and pay the organization back. The organization makes no sales of its own.",
  },
];

export function organizationTypeOf(org: {
  hasStores: boolean;
  usesCreditBranches?: boolean | null;
}): OrganizationType {
  if (org.hasStores) return "stores";
  return org.usesCreditBranches ? "credit" : "direct";
}

export function organizationTypeLabel(type: OrganizationType): string {
  return ORGANIZATION_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}
