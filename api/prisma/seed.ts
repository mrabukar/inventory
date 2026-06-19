import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ?? "superadmin@platform.local";
const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin1!";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME ?? "Platform Super Admin";

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: SUPER_ADMIN_EMAIL },
      select: { id: true, role: true },
    });

    if (existing) {
      if (existing.role !== UserRole.super_admin) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: UserRole.super_admin,
            organizationId: null,
            storeId: null,
          },
        });
        console.log(`Updated existing user to super_admin: ${SUPER_ADMIN_EMAIL}`);
      } else {
        console.log(`Super admin already exists: ${SUPER_ADMIN_EMAIL}`);
      }
      return;
    }

    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const hashedPassword = await hashPassword(SUPER_ADMIN_PASSWORD);

    await prisma.user.create({
      data: {
        id: userId,
        name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL,
        emailVerified: true,
        role: UserRole.super_admin,
        isActive: true,
        organizationId: null,
        storeId: null,
        accounts: {
          create: {
            id: accountId,
            accountId: userId,
            providerId: "credential",
            password: hashedPassword,
          },
        },
      },
    });

    console.log(`Created super_admin: ${SUPER_ADMIN_EMAIL}`);
    console.log(
      "Set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env vars to customize credentials.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
