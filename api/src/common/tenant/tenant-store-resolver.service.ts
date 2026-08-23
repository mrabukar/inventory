import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { requireOrganizationId } from "../utils/require-organization-id.util";
import {
  assertBranchManagerHasStore,
  assertStoreAccess,
  requireActiveManagerStore,
  type ManagerStoreLookup,
} from "../utils/store-scope.util";
import { StoresService } from "../../modules/stores/stores.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenantStoreResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  async resolveStoreFilter(
    user: CurrentUserPayload,
    queryStoreId?: string,
  ): Promise<string | undefined> {
    if (user.role === UserRole.branch_manager) {
      return assertBranchManagerHasStore(user);
    }

    const organizationId = requireOrganizationId(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { hasStores: true },
    });

    if (!org) {
      throw new ForbiddenException("Organization not found");
    }

    if (!org.hasStores) {
      const warehouse =
        await this.storesService.ensureOrgWarehouse(organizationId);
      return warehouse.id;
    }

    const trimmed =
      typeof queryStoreId === "string" ? queryStoreId.trim() : undefined;

    return trimmed || undefined;
  }

  /**
   * Expense P&L scope. Unlike {@link resolveStoreFilter}, non-branch orgs are
   * not pinned to the hidden warehouse — company-wide expenses use storeId null.
   */
  async resolveExpenseStoreFilter(
    user: CurrentUserPayload,
    queryStoreId?: string,
  ): Promise<string | undefined> {
    if (user.role === UserRole.branch_manager) {
      return assertBranchManagerHasStore(user);
    }

    const organizationId = requireOrganizationId(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { hasStores: true },
    });

    if (!org) {
      throw new ForbiddenException("Organization not found");
    }

    if (!org.hasStores) {
      return undefined;
    }

    const trimmed =
      typeof queryStoreId === "string" ? queryStoreId.trim() : undefined;

    return trimmed || undefined;
  }

  async resolveSaleStoreId(
    user: CurrentUserPayload,
    findStore: ManagerStoreLookup,
  ): Promise<string> {
    if (user.role === UserRole.branch_manager) {
      return requireActiveManagerStore(user, findStore);
    }

    if (user.role !== UserRole.admin) {
      throw new ForbiddenException("You are not allowed to submit sales");
    }

    const organizationId = requireOrganizationId(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { hasStores: true },
    });

    if (!org) {
      throw new ForbiddenException("Organization not found");
    }

    if (org.hasStores) {
      throw new ForbiddenException(
        "Sales must be submitted by a branch manager in multi-store organizations",
      );
    }

    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);

    if (!warehouse.isActive) {
      throw new ForbiddenException("Organization stock is inactive");
    }

    return warehouse.id;
  }

  async resolveMutationStoreId(
    user: CurrentUserPayload,
    dtoStoreId?: string,
  ): Promise<string> {
    const organizationId = requireOrganizationId(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { hasStores: true },
    });

    if (!org) {
      throw new ForbiddenException("Organization not found");
    }

    if (!org.hasStores) {
      const warehouse =
        await this.storesService.ensureOrgWarehouse(organizationId);
      return warehouse.id;
    }

    const trimmed =
      typeof dtoStoreId === "string" ? dtoStoreId.trim() : undefined;

    if (!trimmed) {
      throw new BadRequestException("storeId is required");
    }

    assertStoreAccess(trimmed, user);
    return trimmed;
  }
}
