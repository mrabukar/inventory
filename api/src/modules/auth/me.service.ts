import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const storeSelect = {
  id: true,
  name: true,
  address: true,
  isActive: true,
} as const;

const organizationSelect = {
  id: true,
  name: true,
  hasStores: true,
} as const;

export type MeStore = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
};

export type MeOrganization = {
  id: string;
  name: string;
  hasStores: boolean;
};

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(user: Record<string, unknown>) {
    const storeId =
      typeof user.storeId === "string" ? user.storeId.trim() : null;

    const organizationId =
      typeof user.organizationId === "string" ? user.organizationId : null;

    const [store, organization] = await Promise.all([
      storeId != null
        ? this.prisma.store.findUnique({
            where: { id: storeId },
            select: storeSelect,
          })
        : Promise.resolve(null),
      organizationId
        ? this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: organizationSelect,
          })
        : Promise.resolve(null),
    ]);

    return {
      user: {
        ...user,
        store,
        organization,
      },
    };
  }
}
