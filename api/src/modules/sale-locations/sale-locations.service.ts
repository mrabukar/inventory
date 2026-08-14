import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, SaleLocation } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { assertBillingEnabled } from "../../common/utils/require-billing-enabled.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSaleLocationDto } from "./dto/create-sale-location.dto";
import { UpdateSaleLocationDto } from "./dto/update-sale-location.dto";

@Injectable()
export class SaleLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    includeInactive: boolean,
    user: CurrentUserPayload,
  ): Promise<SaleLocation[]> {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    return this.prisma.saleLocation.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async create(
    dto: CreateSaleLocationDto,
    user: CurrentUserPayload,
  ): Promise<SaleLocation> {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    const name = dto.name.trim();
    const existing = await this.prisma.saleLocation.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      throw new ConflictException(`A location named "${name}" already exists`);
    }

    const location = await this.prisma.saleLocation.create({
      data: withOrganizationId({ name }, organizationId),
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: AuditAction.SALE_LOCATION_CREATED,
        entityType: "sale_location",
        entityId: location.id,
        oldValue: Prisma.JsonNull,
        newValue: { id: location.id, name: location.name },
      },
    });

    return location;
  }

  async update(
    id: string,
    dto: UpdateSaleLocationDto,
    user: CurrentUserPayload,
  ): Promise<SaleLocation> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    const existing = await this.prisma.saleLocation.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Location with id "${id}" not found`);
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.prisma.saleLocation.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          id: { not: id },
        },
      });
      if (clash) {
        throw new ConflictException(`A location named "${name}" already exists`);
      }
    }

    const location = await this.prisma.saleLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : undefined),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: AuditAction.SALE_LOCATION_UPDATED,
        entityType: "sale_location",
        entityId: location.id,
        oldValue: { id: existing.id, name: existing.name, isActive: existing.isActive },
        newValue: { id: location.id, name: location.name, isActive: location.isActive },
      },
    });

    return location;
  }
}
