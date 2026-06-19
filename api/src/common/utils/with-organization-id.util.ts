export function withOrganizationId<T extends object>(
  data: T,
  organizationId: string,
): T & { organizationId: string } {
  return { ...data, organizationId };
}
