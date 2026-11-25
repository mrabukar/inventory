/**
 * An organization is one of three kinds:
 * - stores: branch managers sell from their stores;
 * - direct: the admin sells from the organization's own stock;
 * - credit: the organization credits stock to credit branches and makes no
 *   sales of its own; only the branches sell.
 */
export const ORGANIZATION_TYPES = ["stores", "direct", "credit"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export interface OrganizationTypeFlags {
  hasStores: boolean;
  usesCreditBranches: boolean;
}

export function organizationTypeOf(
  flags: OrganizationTypeFlags,
): OrganizationType {
  if (flags.hasStores) return "stores";
  return flags.usesCreditBranches ? "credit" : "direct";
}

export function flagsForOrganizationType(
  type: OrganizationType,
): OrganizationTypeFlags {
  return {
    hasStores: type === "stores",
    usesCreditBranches: type === "credit",
  };
}
