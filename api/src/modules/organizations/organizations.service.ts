import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditAction,
  Organization,
  Prisma,
  StoreType,
  UserRole,
} from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { orderByUpdatedAtDesc } from "../../common/utils/list-order.util";
import {
  flagsForOrganizationType,
  organizationTypeOf,
  type OrganizationType,
} from "../../common/utils/organization-type.util";
import { getBranchBalance } from "../../common/utils/branch-balance.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { DomainPolicyService } from "../../common/tenant/domain-policy.service";
import { isValidHostname, normalizeHost } from "../../common/utils/host.util";
import { PrismaService } from "../../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { UsersService } from "../users/users.service";
import { PaginatedResult } from "../stores/stores.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { OrganizationQueryDto } from "./dto/organization-query.dto";
import { OrganizationUsersQueryDto } from "./dto/organization-users-query.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { UpdateOrganizationUserDto } from "./dto/update-organization-user.dto";

export type OrganizationDetail = Organization & {
  _count: { users: number; stores: number };
};

export type OrganizationUserRow = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    role: true;
    phone: true;
    isActive: true;
    store: { select: { id: true; name: true } };
  };
}>;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainPolicy: DomainPolicyService,
    private readonly storesService: StoresService,
    private readonly usersService: UsersService,
  ) {}

  async findAll(
    query: OrganizationQueryDto,
  ): Promise<PaginatedResult<Organization>> {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = search
      ? { name: { contains: search, mode: "insensitive" } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByUpdatedAtDesc,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<OrganizationDetail> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, stores: true } },
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with id "${id}" not found`);
    }

    return organization;
  }

  async findUsers(
    id: string,
    query: OrganizationUsersQueryDto,
  ): Promise<PaginatedResult<OrganizationUserRow>> {
    await this.findOne(id);

    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      organizationId: id,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByUpdatedAtDesc,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          isActive: true,
          store: { select: { id: true, name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationUserDto,
    actor: CurrentUserPayload,
  ) {
    await this.assertOrgAdminUser(organizationId, userId);
    return this.usersService.update(userId, dto, actor);
  }

  async deactivateUser(
    organizationId: string,
    userId: string,
    actor: CurrentUserPayload,
  ): Promise<void> {
    await this.assertOrgAdminUser(organizationId, userId);
    return this.usersService.deactivate(userId, actor);
  }

  async activateUser(
    organizationId: string,
    userId: string,
    actor: CurrentUserPayload,
  ) {
    await this.assertOrgAdminUser(organizationId, userId);
    return this.usersService.activate(userId, actor);
  }

  private async assertOrgAdminUser(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await this.findOne(organizationId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    if (user.organizationId !== organizationId) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    if (user.role !== UserRole.admin) {
      throw new BadRequestException(
        "Only organization admins can be managed from this endpoint",
      );
    }
  }

  /** Cleans up a domain from the form: null clears it; anything else must be a real hostname. */
  private parseDomain(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    const host = normalizeHost(value ?? "");
    if (!host) return null;
    if (!isValidHostname(host)) {
      throw new BadRequestException(
        "Domain must look like fonex.example.com (no https://, no path)",
      );
    }
    return host;
  }

  async create(
    dto: CreateOrganizationDto,
    actor: CurrentUserPayload,
  ): Promise<Organization> {
    const domain = this.parseDomain(dto.domain);
    const type = dto.type ?? "stores";
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        ...flagsForOrganizationType(type),
        ...(domain ? { domain } : undefined),
        // Direct and credit organizations always bill; one with stores starts without.
        billingEnabled: type !== "stores",
      },
    });

    await this.storesService.ensureOrgWarehouse(organization.id);

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: organization.id,
        action: AuditAction.ORGANIZATION_CREATED,
        entityType: "organization",
        entityId: organization.id,
        oldValue: Prisma.JsonNull,
        newValue: organization,
      },
    });

    return organization;
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    actor: CurrentUserPayload,
  ): Promise<Organization> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);
    const domain = this.parseDomain(dto.domain);

    const currentType = organizationTypeOf(existing);
    const nextType = dto.type ?? currentType;
    if (nextType !== currentType) {
      await this.assertCanChangeType(id, currentType, nextType);
    }
    if (dto.billingEnabled !== undefined && nextType !== "stores") {
      throw new BadRequestException(
        "Billing is always on for direct-sales and credit organizations",
      );
    }

    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
        ...(domain !== undefined ? { domain } : undefined),
        ...(nextType !== currentType
          ? flagsForOrganizationType(nextType)
          : undefined),
        // Direct and credit organizations always bill; one with stores keeps its setting.
        ...(nextType !== "stores"
          ? { billingEnabled: true }
          : dto.billingEnabled !== undefined
            ? { billingEnabled: dto.billingEnabled }
            : undefined),
        ...(dto.isActive !== undefined
          ? { isActive: dto.isActive }
          : undefined),
      },
    });

    this.domainPolicy.forget(organization.id);

    if (nextType !== "stores") {
      await this.storesService.ensureOrgWarehouse(organization.id);
    }

    let action: AuditAction = AuditAction.ORGANIZATION_UPDATED;
    if (dto.isActive === false && existing.isActive) {
      action = AuditAction.ORGANIZATION_DEACTIVATED;
    } else if (dto.isActive === true && !existing.isActive) {
      action = AuditAction.ORGANIZATION_REACTIVATED;
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: organization.id,
        action,
        entityType: "organization",
        entityId: organization.id,
        oldValue: existing,
        newValue: organization,
      },
    });

    return organization;
  }

  /**
   * Switching type must not strand anything: stores stock stays in the stores,
   * and a credit organization's branches must be settled and idle.
   */
  private async assertCanChangeType(
    organizationId: string,
    from: OrganizationType,
    to: OrganizationType,
  ): Promise<void> {
    if (from === "stores") {
      await this.assertCanDisableStores(organizationId);
    }
    if (to === "stores") {
      const creditStores = await this.prisma.store.count({
        where: { organizationId, type: StoreType.credit },
      });
      if (creditStores > 0) {
        throw new BadRequestException(
          "Cannot switch to an organization with stores while credit branches exist",
        );
      }
    }
    if (from === "credit") {
      await this.assertCreditBranchesSettled(organizationId);
    }
  }

  /** No credit branch may hold stock, owe money, or wait on the organization. */
  private async assertCreditBranchesSettled(
    organizationId: string,
  ): Promise<void> {
    const branches = await this.prisma.store.findMany({
      where: { organizationId, type: StoreType.credit },
      select: { id: true, name: true },
    });

    for (const branch of branches) {
      const [stock, balance, pendingSales, pendingPayments] = await Promise.all(
        [
          this.prisma.inventory.aggregate({
            where: { storeId: branch.id, quantity: { gt: 0 } },
            _sum: { quantity: true },
          }),
          getBranchBalance(this.prisma, branch.id),
          this.prisma.sale.count({
            where: { storeId: branch.id, status: "pending" },
          }),
          this.prisma.branchPayment.count({
            where: { storeId: branch.id, status: "pending" },
          }),
        ],
      );

      const problems: string[] = [];
      if ((stock._sum.quantity ?? 0) > 0) {
        problems.push(`${stock._sum.quantity} unit(s) still in stock`);
      }
      if (balance.balance > 0) {
        problems.push(`owes ${balance.balance}`);
      }
      if (pendingSales > 0) {
        problems.push(`${pendingSales} sale(s) waiting for approval`);
      }
      if (pendingPayments > 0) {
        problems.push(`${pendingPayments} payment(s) waiting for approval`);
      }
      if (problems.length > 0) {
        throw new BadRequestException(
          `Cannot stop using credit branches: ${branch.name} has ${problems.join(", ")}. Settle it first.`,
        );
      }
    }
  }

  private async assertCanDisableStores(organizationId: string): Promise<void> {
    const stockSummary = await this.prisma.inventory.aggregate({
      where: {
        organizationId,
        quantity: { gt: 0 },
        store: { isOrgWarehouse: false },
      },
      _sum: { quantity: true },
      _count: { _all: true },
    });

    if (stockSummary._count._all > 0) {
      throw new BadRequestException(
        `Cannot switch to direct-sales mode: ${stockSummary._sum.quantity ?? 0} unit(s) remain across ${stockSummary._count._all} product(s) in branch stores. Clear stock from all stores first.`,
      );
    }
  }

  async findCurrent(user: CurrentUserPayload): Promise<OrganizationDetail> {
    const id = requireOrganizationId(user);
    return this.findOne(id);
  }

  async updateCurrent(
    user: CurrentUserPayload,
    dto: {
      name?: string;
      phone?: string;
      evcNumber?: string;
      edahabNumber?: string;
      accountNumber?: string;
      address?: string;
    },
  ): Promise<Organization> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const id = requireOrganizationId(user);
    const existing = await this.findOne(id);

    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
        ...(dto.phone !== undefined
          ? { phone: dto.phone.trim() || null }
          : undefined),
        ...(dto.evcNumber !== undefined
          ? { evcNumber: dto.evcNumber.trim() || null }
          : undefined),
        ...(dto.edahabNumber !== undefined
          ? { edahabNumber: dto.edahabNumber.trim() || null }
          : undefined),
        ...(dto.accountNumber !== undefined
          ? { accountNumber: dto.accountNumber.trim() || null }
          : undefined),
        ...(dto.address !== undefined
          ? { address: dto.address.trim() || null }
          : undefined),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        action: AuditAction.ORGANIZATION_UPDATED,
        entityType: "organization",
        entityId: organization.id,
        oldValue: existing,
        newValue: organization,
      },
    });

    return organization;
  }

  async getPlatformStats(): Promise<{
    organizationCount: number;
    userCount: number;
  }> {
    const [organizationCount, userCount] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count({
        where: { role: { not: "super_admin" } },
      }),
    ]);

    return { organizationCount, userCount };
  }
}
