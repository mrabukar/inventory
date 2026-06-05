import { Module } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { createAuth } from "./auth.config";
import { MeController } from "./auth.controller";
import {
  AuthSignInHook,
  AuthSignUpHook,
  AuthUserDatabaseHook,
} from "./auth.hooks";

@Module({
  imports: [
    AuthModule.forRootAsync({
      imports: [PrismaModule],
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        auth: createAuth(prisma),
        bodyParser: {
          json: { limit: "2mb" },
          urlencoded: { limit: "2mb", extended: true },
          rawBody: true,
        },
      }),
    }),
  ],
  controllers: [MeController],
  providers: [AuthSignInHook, AuthSignUpHook, AuthUserDatabaseHook],
})
export class BetterAuthNestModule {}
