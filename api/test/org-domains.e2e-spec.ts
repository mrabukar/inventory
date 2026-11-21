/**
 * Integration tests for keeping each organization on its own domain.
 * Runs only when TEST_DATABASE_URL points at a database whose name ends in `_test`.
 */
import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { firstValueFrom, of } from "rxjs";
import { DomainPolicyService } from "../src/common/tenant/domain-policy.service";
import { TenantContextService } from "../src/common/tenant/tenant-context.service";
import { TenantInterceptor } from "../src/common/tenant/tenant.interceptor";
import { PrismaService } from "../src/prisma/prisma.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl
  ? new URL(testDatabaseUrl).pathname.replace(/^\//, "")
  : "";
const describeDb = databaseName.endsWith("_test") ? describe : describe.skip;

describeDb("Organization domains (PostgreSQL)", () => {
  let prisma: PrismaService;
  let policy: DomainPolicyService;
  let interceptor: TenantInterceptor;
  const suffix = randomUUID().slice(0, 8);
  const fonexHost = `fonex-${suffix}.example.test`;
  const sanabilHost = `sanabil-${suffix}.example.test`;
  const adminHost = `admin-${suffix}.example.test`;
  let fonexOrg: string;
  let sanabilOrg: string;
  let sharedA: string;
  let sharedB: string;
  let noDomainOrg: string;

  const org = (name: string, domain: string | null) =>
    prisma.organization
      .create({ data: { name: `${name} ${suffix}`, domain } })
      .then((o) => o.id);

  const callAs = (
    host: string | undefined,
    user: Record<string, unknown> | undefined,
  ) =>
    firstValueFrom(
      interceptor.intercept(
        {
          switchToHttp: () => ({
            getRequest: () => ({ user, headers: host ? { host } : {} }),
          }),
        } as never,
        { handle: () => of("ok") },
      ),
    );

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const tenant = new TenantContextService();
    prisma = new PrismaService(tenant);
    await prisma.$connect();
    policy = new DomainPolicyService(prisma);
    interceptor = new TenantInterceptor(tenant, policy);

    fonexOrg = await org("Fonex", fonexHost);
    sanabilOrg = await org("Sanabil", sanabilHost);
    sharedA = await org("Shared A", `shared-${suffix}.example.test`);
    sharedB = await org("Shared B", `shared-${suffix}.example.test`);
    noDomainOrg = await org("No domain", null);

    process.env.ENFORCE_ORG_DOMAINS = "true";
    // The super admin may use the admin host and the fonex host, not sanabil.
    process.env.PLATFORM_ADMIN_HOST = `${adminHost}, ${fonexHost}`;
  });

  afterAll(async () => {
    delete process.env.ENFORCE_ORG_DOMAINS;
    delete process.env.PLATFORM_ADMIN_HOST;
    await prisma.$disconnect();
  });

  it("lets an organization's people in on its own domain only", async () => {
    const fonexUser = { role: UserRole.admin, organizationId: fonexOrg };
    expect(await policy.isAllowed(fonexHost, fonexUser)).toBe(true);
    expect(await policy.isAllowed(sanabilHost, fonexUser)).toBe(false);
    expect(await policy.isAllowed(adminHost, fonexUser)).toBe(false);
    expect(await policy.isAllowed(undefined, fonexUser)).toBe(false);
  });

  it("ignores case and ports on the host", async () => {
    const user = { role: UserRole.branch_manager, organizationId: fonexOrg };
    expect(await policy.isAllowed(fonexHost.toUpperCase() + ":443", user)).toBe(
      true,
    );
  });

  it("lets organizations share one domain", async () => {
    const host = `shared-${suffix}.example.test`;
    expect(
      await policy.isAllowed(host, {
        role: UserRole.admin,
        organizationId: sharedA,
      }),
    ).toBe(true);
    expect(
      await policy.isAllowed(host, {
        role: UserRole.admin,
        organizationId: sharedB,
      }),
    ).toBe(true);
  });

  it("blocks an organization that has no domain", async () => {
    expect(
      await policy.isAllowed(fonexHost, {
        role: UserRole.admin,
        organizationId: noDomainOrg,
      }),
    ).toBe(false);
  });

  it("keeps the super admin on the hosts listed for it", async () => {
    const superAdmin = { role: UserRole.super_admin, organizationId: null };
    expect(await policy.isAllowed(adminHost, superAdmin)).toBe(true);
    expect(await policy.isAllowed(fonexHost, superAdmin)).toBe(true);
    expect(await policy.isAllowed(sanabilHost, superAdmin)).toBe(false);
  });

  it("allows everything while enforcement is off", async () => {
    process.env.ENFORCE_ORG_DOMAINS = "false";
    try {
      expect(
        await policy.isAllowed(sanabilHost, {
          role: UserRole.admin,
          organizationId: fonexOrg,
        }),
      ).toBe(true);
    } finally {
      process.env.ENFORCE_ORG_DOMAINS = "true";
    }
  });

  it("refuses a signed-in request that arrives on another domain", async () => {
    const user = { role: UserRole.admin, organizationId: fonexOrg };
    await expect(callAs(fonexHost, user)).resolves.toBe("ok");
    await expect(callAs(sanabilHost, user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // Public requests (no signed-in user) are not affected.
    await expect(callAs(sanabilHost, undefined)).resolves.toBe("ok");
  });

  it("picks up a changed domain straight away once the cache is cleared", async () => {
    const id = await org("Moves", `old-${suffix}.example.test`);
    const user = { role: UserRole.admin, organizationId: id };
    expect(await policy.isAllowed(`old-${suffix}.example.test`, user)).toBe(
      true,
    );
    await prisma.organization.update({
      where: { id },
      data: { domain: `new-${suffix}.example.test` },
    });
    policy.forget(id);
    expect(await policy.isAllowed(`old-${suffix}.example.test`, user)).toBe(
      false,
    );
    expect(await policy.isAllowed(`new-${suffix}.example.test`, user)).toBe(
      true,
    );
  });

  describe("branding for the sign-in page", () => {
    it("names the organization when exactly one uses the domain", async () => {
      const tenant = await policy.tenantForHost(fonexHost);
      expect(tenant?.name).toBe(`Fonex ${suffix}`);
    });

    it("stays generic when several organizations share the domain or none match", async () => {
      expect(
        await policy.tenantForHost(`shared-${suffix}.example.test`),
      ).toBeNull();
      expect(await policy.tenantForHost("nobody.example.test")).toBeNull();
    });

    it("labels the admin domain", async () => {
      expect((await policy.tenantForHost(adminHost))?.name).toBe(
        "Platform admin",
      );
    });

    it("ignores an organization that has been switched off", async () => {
      await prisma.organization.update({
        where: { id: sanabilOrg },
        data: { isActive: false },
      });
      expect(await policy.tenantForHost(sanabilHost)).toBeNull();
    });
  });
});
