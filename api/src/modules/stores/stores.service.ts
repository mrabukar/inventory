import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Store } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { CreateStoreDto } from "./dto/create-store.dto";

interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Store>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.store.count({ where: { isActive: true } }),
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

  async create(dto: CreateStoreDto): Promise<Store> {
    const existing = await this.prisma.store.findFirst({
      where: { name: dto.name, isActive: true },
    });

    if (existing) {
      throw new ConflictException(`A store named "${dto.name}" already exists`);
    }

    return this.prisma.store.create({ data: dto });
  }
}
