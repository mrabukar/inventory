import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, Store } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStoreDto } from "./dto/create-store.dto";
import { StoreQueryDto } from "./dto/store-query.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: StoreQueryDto): Promise<PaginatedResult<Store>> {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StoreWhereInput = {
      isActive: true,
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : undefined),
    };

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.store.count({ where }),
    ]);

    return {
      data: stores,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Store> {
    const store = await this.prisma.store.findFirst({
      where: { id, isActive: true },
    });

    if (!store) {
      throw new NotFoundException(`Store with id "${id}" not found`);
    }

    return store;
  }

  async create(dto: CreateStoreDto, user: CurrentUserPayload): Promise<Store> {
    await this.assertUniqueName(dto.name);

    const store = await this.prisma.store.create({ data: dto });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.STORE_CREATED,
        entityType: "store",
        entityId: store.id,
        oldValue: Prisma.JsonNull,
        newValue: store,
      },
    });

    return store;
  }

  async update(
    id: string,
    dto: UpdateStoreDto,
    user: CurrentUserPayload,
  ): Promise<Store> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);

    if (dto.name && dto.name !== existing.name) {
      await this.assertUniqueName(dto.name);
    }

    const store = await this.prisma.store.update({
      where: { id },
      data: dto,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.STORE_UPDATED,
        entityType: "store",
        entityId: store.id,
        oldValue: existing,
        newValue: store,
      },
    });

    return store;
  }

  async deactivate(id: string, user: CurrentUserPayload): Promise<void> {
    const existing = await this.findOne(id);

    await this.prisma.store.update({
      where: { id },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.STORE_DEACTIVATED,
        entityType: "store",
        entityId: id,
        oldValue: existing,
        newValue: { ...existing, isActive: false },
      },
    });
  }

  private async assertUniqueName(name: string): Promise<void> {
    const existing = await this.prisma.store.findFirst({
      where: { name, isActive: true },
    });

    if (existing) {
      throw new ConflictException(`A store named "${name}" already exists`);
    }
  }
}
