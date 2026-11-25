/**
 * Over real HTTP: a request is scoped to the signed-in user's organization,
 * limited users included. Runs only when TEST_DATABASE_URL points at a database
 * whose name ends in `_test`.
 */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { TenantModule } from "../src/common/tenant/tenant.module";
import { CategoriesController } from "../src/modules/categories/categories.controller";
import { CategoriesService } from "../src/modules/categories/categories.service";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";

jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn() }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl
  ? new URL(testDatabaseUrl).pathname.replace(/^\//, "")
  : "";
const describeDb = databaseName.endsWith("_test") ? describe : describe.skip;

describeDb("Tenant scoping over HTTP (PostgreSQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const orgA = `a-${randomUUID().slice(0, 8)}`;
  const orgB = `b-${randomUUID().slice(0, 8)}`;
  const limitedId = randomUUID();
  const adminId = randomUUID();

  // Stands in for the sign-in guard: the caller arrives in a header.
  const as = (user: Record<string, unknown>) => JSON.stringify(user);

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, TenantModule],
      controllers: [CategoriesController],
      providers: [CategoriesService],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: any, _res: unknown, next: () => void) => {
      const raw = req.headers["x-test-user"];
      if (raw) req.user = JSON.parse(String(raw));
      next();
    });
    await app.init();
    prisma = app.get(PrismaService);

    for (const id of [orgA, orgB]) {
      await prisma.organization.create({ data: { id, name: `Org ${id}` } });
      await prisma.category.create({
        data: { name: `Cat of ${id}`, organizationId: id },
      });
    }
    await prisma.user.create({
      data: {
        id: limitedId,
        email: `l-${limitedId}@example.test`,
        role: UserRole.limited_user,
        organizationId: orgA,
        allowedPages: ["categories"],
      },
    });
    await prisma.user.create({
      data: {
        id: adminId,
        email: `a-${adminId}@example.test`,
        role: UserRole.admin,
        organizationId: orgA,
      },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const names = (res: request.Response) =>
    (res.body as { name: string }[]).map((c) => c.name);

  it("shows an admin only their organization's categories", async () => {
    const res = await request(app.getHttpServer())
      .get("/categories")
      .set(
        "x-test-user",
        as({ id: adminId, role: "admin", organizationId: orgA }),
      );
    expect(res.status).toBe(200);
    expect(names(res)).toEqual([`Cat of ${orgA}`]);
  });

  it("shows another organization's limited user only theirs", async () => {
    const otherId = randomUUID();
    await prisma.user.create({
      data: {
        id: otherId,
        email: `o-${otherId}@example.test`,
        role: UserRole.limited_user,
        organizationId: orgB,
        allowedPages: ["categories"],
      },
    });
    const res = await request(app.getHttpServer())
      .get("/categories")
      .set(
        "x-test-user",
        as({ id: otherId, role: "limited_user", organizationId: orgB }),
      );
    expect(res.status).toBe(200);
    expect(names(res)).toEqual([`Cat of ${orgB}`]);
  });

  it("shows a limited user only their organization's categories", async () => {
    const res = await request(app.getHttpServer())
      .get("/categories")
      .set(
        "x-test-user",
        as({ id: limitedId, role: "limited_user", organizationId: orgA }),
      );
    expect(res.status).toBe(200);
    expect(names(res)).toEqual([`Cat of ${orgA}`]);
  });
});
