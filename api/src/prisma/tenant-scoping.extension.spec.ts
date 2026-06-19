import { TenantContextService } from "../common/tenant/tenant-context.service";
import {
  injectCreateData,
  shouldBypass,
  withOrgWhere,
} from "./tenant-scoping.extension";

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

describe("tenant scoping helpers", () => {
  it("merges organizationId into where for update/delete style queries", () => {
    expect(withOrgWhere({ id: 1 }, "org-a")).toEqual({
      id: 1,
      organizationId: "org-a",
    });
    expect(withOrgWhere(undefined, "org-a")).toEqual({
      organizationId: "org-a",
    });
  });

  it("injects organizationId into create payloads", () => {
    expect(injectCreateData({ name: "Widget" }, "org-a")).toEqual({
      name: "Widget",
      organizationId: "org-a",
    });
    expect(injectCreateData([{ name: "A" }, { name: "B" }], "org-a")).toEqual([
      { name: "A", organizationId: "org-a" },
      { name: "B", organizationId: "org-a" },
    ]);
  });

  it("bypasses non-tenant models", () => {
    expect(shouldBypass("Organization", "org-a")).toBe(true);
  });

  it("bypasses when organizationId is null or undefined", () => {
    expect(shouldBypass("Product", null)).toBe(true);
    expect(shouldBypass("Product", undefined)).toBe(true);
  });

  it("scopes tenant models when organizationId is set", () => {
    expect(shouldBypass("Product", "org-a")).toBe(false);
  });
});
