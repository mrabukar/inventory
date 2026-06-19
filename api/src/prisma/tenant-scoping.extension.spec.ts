import { TenantContextService } from "../common/tenant/tenant-context.service";

describe("tenant scoping", () => {
  it("carries organizationId through async context", () => {
    const tenantContext = new TenantContextService();

    tenantContext.run("org-a", () => {
      expect(tenantContext.get()).toBe("org-a");
    });

    expect(tenantContext.get()).toBeUndefined();
  });

  it("uses null organizationId for super_admin bypass", () => {
    const tenantContext = new TenantContextService();

    tenantContext.run(null, () => {
      expect(tenantContext.get()).toBeNull();
    });
  });
});
