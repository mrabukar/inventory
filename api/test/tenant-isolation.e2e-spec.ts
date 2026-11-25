/**
 * One organization must never read or change another's records by id.
 * Runs only when TEST_DATABASE_URL points at a database whose name ends in `_test`.
 */
import { randomUUID } from "node:crypto";
import { UserRole } from "@prisma/client";
import { withOrganizationId } from "../src/common/utils/with-organization-id.util";
import { TenantContextService } from "../src/common/tenant/tenant-context.service";
import { PrismaService } from "../src/prisma/prisma.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl
  ? new URL(testDatabaseUrl).pathname.replace(/^\//, "")
  : "";
const describeDb = databaseName.endsWith("_test") ? describe : describe.skip;

describeDb("Tenant isolation (PostgreSQL)", () => {
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let orgA: string;
  let orgB: string;
  let customerA: string;
  let customerB: string;
  let userB: string;
  let categoryB: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    tenant = new TenantContextService();
    prisma = new PrismaService(tenant);
    await prisma.$connect();

    const suffix = randomUUID().slice(0, 8);
    orgA = (await prisma.organization.create({ data: { name: `A ${suffix}` } }))
      .id;
    orgB = (await prisma.organization.create({ data: { name: `B ${suffix}` } }))
      .id;
    const creatorId = randomUUID();
    await prisma.user.create({
      data: withOrganizationId(
        {
          id: creatorId,
          email: `creator-${suffix}@example.test`,
          role: UserRole.admin,
        },
        orgA,
      ),
    });
    customerA = (
      await prisma.customer.create({
        data: withOrganizationId(
          { name: "Customer A", createdById: creatorId },
          orgA,
        ),
      })
    ).id;
    customerB = (
      await prisma.customer.create({
        data: withOrganizationId(
          { name: "Customer B", createdById: creatorId },
          orgB,
        ),
      })
    ).id;
    userB = (
      await prisma.user.create({
        data: withOrganizationId(
          {
            id: randomUUID(),
            email: `b-${suffix}@example.test`,
            role: UserRole.admin,
          },
          orgB,
        ),
      })
    ).id;
    categoryB = (
      await prisma.category.create({
        data: withOrganizationId({ name: "Category B" }, orgB),
      })
    ).id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // Prisma queries are lazy: await inside the context, as the app's services do.
  const inOrg = <T>(org: string | null, fn: () => PromiseLike<T>) =>
    tenant.run(org, async () => await fn());
  const asA = <T>(fn: () => PromiseLike<T>) => inOrg(orgA, fn);

  it("finds the organization's own record by id", async () => {
    const found = await asA(() =>
      prisma.customer.findUnique({ where: { id: customerA } }),
    );
    expect(found?.name).toBe("Customer A");
  });

  it("does not find another organization's record by id", async () => {
    await expect(
      asA(() => prisma.customer.findUnique({ where: { id: customerB } })),
    ).resolves.toBeNull();
    await expect(
      asA(() => prisma.user.findUnique({ where: { id: userB } })),
    ).resolves.toBeNull();
    await expect(
      asA(() => prisma.category.findUnique({ where: { id: categoryB } })),
    ).resolves.toBeNull();
  });

  it("throws instead of returning another organization's record", async () => {
    await expect(
      asA(() =>
        prisma.customer.findUniqueOrThrow({ where: { id: customerB } }),
      ),
    ).rejects.toThrow();
    await expect(
      asA(() =>
        prisma.customer.findUniqueOrThrow({ where: { id: customerA } }),
      ),
    ).resolves.toMatchObject({ name: "Customer A" });
  });

  it("keeps finding by email inside the organization", async () => {
    await expect(
      inOrg(orgB, () => prisma.user.findUnique({ where: { id: userB } })),
    ).resolves.not.toBeNull();
  });

  it("does not list, count or change another organization's records", async () => {
    const list = await asA(() => prisma.customer.findMany());
    expect(list.map((c) => c.id)).not.toContain(customerB);

    await expect(
      asA(() =>
        prisma.customer.update({
          where: { id: customerB },
          data: { name: "HACKED" },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      asA(() =>
        prisma.customer.updateMany({
          where: { id: customerB },
          data: { name: "HACKED" },
        }),
      ),
    ).resolves.toMatchObject({ count: 0 });
    await expect(
      asA(() => prisma.customer.delete({ where: { id: customerB } })),
    ).rejects.toThrow();

    const untouched = await prisma.customer.findUnique({
      where: { id: customerB },
    });
    expect(untouched?.name).toBe("Customer B");
  });

  it("still lets the platform super admin (no organization) read any record", async () => {
    await expect(
      inOrg(null, () =>
        prisma.customer.findUnique({ where: { id: customerB } }),
      ),
    ).resolves.not.toBeNull();
  });
});
