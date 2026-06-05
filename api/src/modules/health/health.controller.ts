import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("Health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @AllowAnonymous()
  @Get()
  @ApiOperation({ summary: "API liveness check" })
  @ApiOkResponse({ schema: { example: { status: "ok" } } })
  check(): { status: string } {
    return { status: "ok" };
  }

  @Get("db")
  @ApiCookieAuth("better-auth.session_token")
  @ApiOperation({ summary: "PostgreSQL connectivity check (requires auth)" })
  @ApiOkResponse({
    schema: { example: { status: "ok", database: "connected" } },
  })
  @ApiServiceUnavailableResponse({
    schema: { example: { status: "error", database: "disconnected" } },
  })
  @ApiUnauthorizedResponse({ schema: { example: { message: "Unauthorized" } } })
  async checkDatabase(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected" };
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        database: "disconnected",
      });
    }
  }
}
