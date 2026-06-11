/** Default Prisma interactive transaction timeout is 5s — too low under load with row locks + audit writes. */
export const MUTATION_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 15_000,
} as const;
