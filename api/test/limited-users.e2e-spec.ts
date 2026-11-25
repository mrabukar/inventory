/**
 * Integration tests for limited users: the access check on every request, the
 * rules for creating and editing them, and how they read an organization's
 * data. Runs only when TEST_DATABASE_URL points at a database whose name ends
 * in `_test`.
 */
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { firstValueFrom, of } from "rxjs";
import { PageAccessInterceptor } from "../src/common/access/page-access.interceptor";
import type { CurrentUserPayload } from "../src/common/decorators/current-user.decorator";
import {
  LimitedSelf,
  PageMarks,
  PageRead,
} from "../src/common/decorators/page-access.decorator";
import { DomainPolicyService } from "../src/common/tenant/domain-policy.service";
import { TenantContextService } from "../src/common/tenant/tenant-context.service";
import { TenantStoreResolver } from "../src/common/tenant/tenant-store-resolver.service";
import { branchScopeOf } from "../src/common/utils/credit-branch.util";
import type { OrganizationType } from "../src/common/utils/organization-type.util";
import { changesUserAccess } from "../src/modules/auth/auth.constants";
import { CreditBranchesService } from "../src/modules/credit-branches/credit-branches.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { ProductsService } from "../src/modules/products/products.service";
import { StoresService } from "../src/modules/stores/stores.service";
import { UsersService } from "../src/modules/users/users.service";
import { PrismaService } from "../src/prisma/prisma.service";

// UsersService pulls in Better-Auth's ESM-only crypto; not needed here.
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn() }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl
  ? new URL(testDatabaseUrl).pathname.replace(/^\//, "")
  : "";
const describeDb = databaseName.endsWith("_test") ? describe : describe.skip;

/** A few routes with the same marks the real ones carry. */
class Routes {
  @PageRead(["sales"])
  salesRead() {
    return "sales";
  }

  @PageRead(["sales"])
  salesChange() {
    return "changed";
  }

  @PageMarks(["*"])
  anyPage() {
    return "any";
  }

  @LimitedSelf()
  profile() {
    return "me";
  }

  unmarked() {
    return "unmarked";
  }
}

describeDb("Limited users (PostgreSQL)", () => {
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let organizations: OrganizationsService;
  let users: UsersService;
  let creditBranches: CreditBranchesService;
  let customers: CustomersService;
  let interceptor: PageAccessInterceptor;
  let superAdmin: CurrentUserPayload;

  async function makeUser(
    organizationId: string | null,
    role: UserRole,
    allowedPages: string[] = [],
  ): Promise<CurrentUserPayload> {
    const row = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `${role}-${randomUUID().slice(0, 8)}@example.test`,
        role,
        organizationId,
        allowedPages,
      },
    });
    return {
      id: row.id,
      email: row.email,
      role,
      organizationId,
      storeId: null,
      isActive: true,
    };
  }

  async function makeOrg(type: OrganizationType) {
    const org = await organizations.create(
      { name: `${type} ${randomUUID().slice(0, 8)}`, type },
      superAdmin,
    );
    const admin = await makeUser(org.id, UserRole.admin);
    return { organizationId: org.id, admin };
  }

  /** Runs a route through the access check as this user and returns what the route said. */
  function call(
    user: CurrentUserPayload,
    route: keyof Routes,
    method = "GET",
  ): Promise<unknown> {
    const routes = new Routes();
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ method, user }) }),
      getHandler: () => Routes.prototype[route],
      getClass: () => Routes,
    };
    return firstValueFrom(
      interceptor.intercept(context as never, {
        handle: () => of(routes[route]()),
      }),
    );
  }

  const setPages = (userId: string, allowedPages: string[]) =>
    prisma.user.update({ where: { id: userId }, data: { allowedPages } });

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    tenant = new TenantContextService();
    prisma = new PrismaService(tenant);
    await prisma.$connect();
    const stores = new StoresService(prisma);
    const resolver = new TenantStoreResolver(prisma, stores);
    users = new UsersService(prisma);
    creditBranches = new CreditBranchesService(
      prisma,
      new ProductsService(prisma),
      stores,
    );
    customers = new CustomersService(prisma, new PaymentsService(prisma));
    organizations = new OrganizationsService(
      prisma,
      new DomainPolicyService(prisma),
      stores,
      users,
    );
    interceptor = new PageAccessInterceptor(new Reflector(), prisma, tenant);
    superAdmin = await makeUser(null, UserRole.super_admin);
    expect(resolver).toBeDefined();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("the access check on each request", () => {
    it("lets a limited user read a route for a page they hold", async () => {
      const { organizationId } = await makeOrg("direct");
      const user = await makeUser(organizationId, UserRole.limited_user, [
        "sales",
      ]);
      await expect(call(user, "salesRead")).resolves.toBe("sales");
    });

    it("refuses a page they don't hold", async () => {
      const { organizationId } = await makeOrg("direct");
      const user = await makeUser(organizationId, UserRole.limited_user, [
        "inventory",
      ]);
      await expect(call(user, "salesRead")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("refuses every way of changing data, even on a page they hold", async () => {
      const { organizationId } = await makeOrg("direct");
      const user = await makeUser(organizationId, UserRole.limited_user, [
        "sales",
      ]);
      for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
        await expect(call(user, "salesChange", method)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      }
    });

    it("keeps a route nobody marked closed", async () => {
      const { organizationId } = await makeOrg("direct");
      const user = await makeUser(organizationId, UserRole.limited_user, [
        "sales",
        "inventory",
      ]);
      await expect(call(user, "unmarked")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("opens the shared lookups to anyone holding at least one page", async () => {
      const { organizationId } = await makeOrg("direct");
      const some = await makeUser(organizationId, UserRole.limited_user, [
        "expenses",
      ]);
      const none = await makeUser(organizationId, UserRole.limited_user, []);
      await expect(call(some, "anyPage")).resolves.toBe("any");
      await expect(call(none, "anyPage")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("lets them read and edit their own profile, and nothing else on it", async () => {
      const { organizationId } = await makeOrg("direct");
      const user = await makeUser(organizationId, UserRole.limited_user, []);
      await expect(call(user, "profile", "GET")).resolves.toBe("me");
      await expect(call(user, "profile", "PATCH")).resolves.toBe("me");
      await expect(call(user, "profile", "DELETE")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("takes a removed page away on the very next request", async () => {
      const { organizationId } = await makeOrg("direct");
      const user = await makeUser(organizationId, UserRole.limited_user, [
        "sales",
      ]);
      await expect(call(user, "salesRead")).resolves.toBe("sales");
      await setPages(user.id, []);
      await expect(call(user, "salesRead")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await setPages(user.id, ["sales"]);
      await expect(call(user, "salesRead")).resolves.toBe("sales");
    });

    it("refuses an account that was switched off or given another role since sign-in", async () => {
      const { organizationId } = await makeOrg("direct");
      const off = await makeUser(organizationId, UserRole.limited_user, [
        "sales",
      ]);
      await prisma.user.update({
        where: { id: off.id },
        data: { isActive: false },
      });
      await expect(call(off, "salesRead")).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const promoted = await makeUser(organizationId, UserRole.limited_user, [
        "sales",
      ]);
      await prisma.user.update({
        where: { id: promoted.id },
        data: { role: UserRole.admin },
      });
      // The old session still says limited; the database says otherwise.
      await expect(call(promoted, "salesRead")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("leaves admins and branch managers exactly as they were", async () => {
      const { organizationId, admin } = await makeOrg("direct");
      const manager = await makeUser(organizationId, UserRole.branch_manager);
      for (const who of [admin, manager]) {
        await expect(call(who, "unmarked")).resolves.toBe("unmarked");
        await expect(call(who, "salesChange", "POST")).resolves.toBe("changed");
      }
    });
  });

  describe("creating and editing a limited user", () => {
    it("lets an admin give pages that exist for a credit organization", async () => {
      const { organizationId, admin } = await makeOrg("credit");
      const user = await makeUser(organizationId, UserRole.limited_user);
      const updated = await tenant.run(organizationId, () =>
        users.update(
          user.id,
          { allowedPages: ["dashboard", "credit-branches", "sale-approvals"] },
          admin,
        ),
      );
      expect(updated.allowedPages).toEqual([
        "dashboard",
        "credit-branches",
        "sale-approvals",
      ]);
    });

    it("refuses credit-only pages in a direct-sales organization, and unknown pages", async () => {
      const { organizationId, admin } = await makeOrg("direct");
      const user = await makeUser(organizationId, UserRole.limited_user);
      await expect(
        tenant.run(organizationId, () =>
          users.update(user.id, { allowedPages: ["credit-branches"] }, admin),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        tenant.run(organizationId, () =>
          users.update(user.id, { allowedPages: ["settings"] }, admin),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        tenant.run(organizationId, () =>
          users.update(user.id, { allowedPages: [] }, admin),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("keeps limited users out of an organization with stores", async () => {
      const { organizationId, admin } = await makeOrg("stores");
      const user = await makeUser(organizationId, UserRole.admin);
      await expect(
        tenant.run(organizationId, () =>
          users.update(
            user.id,
            { role: UserRole.limited_user, allowedPages: ["dashboard"] },
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("needs pages when someone becomes a limited user, and clears them when they stop", async () => {
      const { organizationId, admin } = await makeOrg("direct");
      const user = await makeUser(organizationId, UserRole.admin);

      await expect(
        tenant.run(organizationId, () =>
          users.update(user.id, { role: UserRole.limited_user }, admin),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const limited = await tenant.run(organizationId, () =>
        users.update(
          user.id,
          { role: UserRole.limited_user, allowedPages: ["expenses"] },
          admin,
        ),
      );
      expect(limited.role).toBe(UserRole.limited_user);
      expect(limited.storeId).toBeNull();

      const back = await tenant.run(organizationId, () =>
        users.update(user.id, { role: UserRole.admin }, admin),
      );
      expect(back.allowedPages).toEqual([]);
    });

    it("gives pages only to a limited user", async () => {
      const { organizationId, admin } = await makeOrg("direct");
      const other = await makeUser(organizationId, UserRole.admin);
      await expect(
        tenant.run(organizationId, () =>
          users.update(other.id, { allowedPages: ["sales"] }, admin),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("never lets pages or roles be changed through the auth library's update", () => {
      expect(changesUserAccess({ allowedPages: ["sales"] })).toBe(true);
      expect(changesUserAccess({ role: "admin" })).toBe(true);
      expect(changesUserAccess({ name: "Only a name" })).toBe(false);
    });

    it("does not touch another organization's users", async () => {
      const mine = await makeOrg("direct");
      const theirs = await makeOrg("direct");
      const theirUser = await makeUser(
        theirs.organizationId,
        UserRole.limited_user,
      );
      await expect(
        tenant.run(mine.organizationId, () =>
          users.update(theirUser.id, { allowedPages: ["sales"] }, mine.admin),
        ),
      ).rejects.toThrow();
      const untouched = await prisma.user.findUniqueOrThrow({
        where: { id: theirUser.id },
      });
      expect(untouched.allowedPages).toEqual([]);
    });
  });

  describe("reading an organization's data", () => {
    it("lets a limited user in a credit organization use the same branch scope as an admin", async () => {
      const { organizationId } = await makeOrg("credit");
      const limited = await makeUser(organizationId, UserRole.limited_user, [
        "dashboard",
      ]);
      const scope = await tenant.run(organizationId, () =>
        branchScopeOf(prisma, limited, "all"),
      );
      expect(scope.kind).toBe("all");
    });

    it("lets them list the branches and customers, and nothing outside their organization", async () => {
      const mine = await makeOrg("credit");
      const other = await makeOrg("credit");
      const limited = await makeUser(
        mine.organizationId,
        UserRole.limited_user,
        ["credit-branches", "customers"],
      );
      await tenant.run(mine.organizationId, () =>
        creditBranches.createBranch(
          { name: "Mine", address: "Main St" },
          mine.admin,
        ),
      );
      await tenant.run(other.organizationId, () =>
        creditBranches.createBranch(
          { name: "Theirs", address: "Main St" },
          other.admin,
        ),
      );

      const branches = await tenant.run(mine.organizationId, () =>
        creditBranches.findAll(limited),
      );
      expect(branches.map((b) => b.name)).toEqual(["Mine"]);

      const list = await tenant.run(mine.organizationId, () =>
        customers.findAll({ page: 1, limit: 20, storeId: "all" }, limited),
      );
      expect(list.data).toEqual([]);
    });
  });
});
