import { PrismaClient } from "@prisma/client";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { parseTrustedOrigins } from "./auth.constants";

function getAuthSecret(isProd: boolean): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (isProd) {
    if (!secret || secret.length < 32) {
      throw new Error(
        "BETTER_AUTH_SECRET must be at least 32 characters in production",
      );
    }
    return secret;
  }

  return secret ?? "dev-secret-change-me";
}

export function createAuth(prisma: PrismaClient) {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";

  const url =
    process.env.BETTER_AUTH_URL ??
    `http://localhost:${process.env.PORT ?? 4000}`;

  return betterAuth({
    url,
    secret: getAuthSecret(isProd),
    basePath: "/api/auth",
    trustedOrigins: parseTrustedOrigins(
      process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    ),
    hooks: {},
    databaseHooks: {},

    database: prismaAdapter(prisma, { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: false,
    },

    user: {
      additionalFields: {
        role: {
          type: "string",
          input: true,
          required: true,
        },
        isActive: {
          type: "boolean",
          input: false,
        },
        storeId: {
          type: "string",
          input: true,
          required: false,
        },
        name: {
          type: "string",
          input: true,
        },
      },
    },

    session: {
      expiresIn: 60 * 60,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60,
      },
    },

    advanced: {
      useSecureCookies: isProd,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: isProd,
        sameSite: "strict",
      },
    },
  });
}

export type AppAuth = ReturnType<typeof createAuth>;

export const auth = createAuth(new PrismaClient());
