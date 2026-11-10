import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Session } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { Roles } from "../../common/decorators/roles.decorator";
import { DisableOwnTwoFactorDto } from "./dto/disable-own-two-factor.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { MeService } from "./me.service";

@Controller()
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get("me")
  me(@Session() session: { user: Record<string, unknown> }) {
    return this.meService.getProfile(session.user);
  }

  @Patch("me")
  updateMe(
    @Session() session: { user: Record<string, unknown> },
    @Body() dto: UpdateMeDto,
  ) {
    const userId =
      typeof session.user.id === "string" ? session.user.id.trim() : "";
    return this.meService.updateProfile(userId, dto);
  }

  @Post("me/two-factor/disable")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.admin)
  disableOwnTwoFactor(
    @Session() session: { user: Record<string, unknown> },
    @Body() dto: DisableOwnTwoFactorDto,
    @Req() req: Request,
  ) {
    const userId =
      typeof session.user.id === "string" ? session.user.id.trim() : "";
    return this.meService.disableOwnTwoFactor(
      userId,
      dto,
      fromNodeHeaders(req.headers),
    );
  }
}
