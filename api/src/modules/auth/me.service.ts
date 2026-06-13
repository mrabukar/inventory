import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const storeSelect = {
  id: true,
  name: true,
  address: true,
  isActive: true,
} as const;

export type MeStore = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
};

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(user: Record<string, unknown>) {
    const storeId =
      typeof user.storeId === "string" ? user.storeId.trim() : null;

    const store: MeStore | null =
      storeId != null
        ? await this.prisma.store.findUnique({
            where: { id: storeId },
            select: storeSelect,
          })
        : null;

    return {
      user: {
        ...user,
        store,
      },
    };
  }
}
