import { Prisma } from "@prisma/client";

/** Better-Auth stores trusted-device records as verification rows with this prefix. */
export const TRUST_DEVICE_IDENTIFIER_PREFIX = "trust-device-";

type VerificationWriter = {
  verification: {
    deleteMany: (
      args: Prisma.VerificationDeleteManyArgs,
    ) => Promise<Prisma.BatchPayload>;
  };
};

export function trustedDeviceWhere(
  userId: string,
): Prisma.VerificationWhereInput {
  return {
    value: userId,
    identifier: { startsWith: TRUST_DEVICE_IDENTIFIER_PREFIX },
  };
}

export async function revokeTrustedDevices(
  db: VerificationWriter,
  userId: string,
): Promise<void> {
  if (!userId) {
    return;
  }

  await db.verification.deleteMany({
    where: trustedDeviceWhere(userId),
  });
}
