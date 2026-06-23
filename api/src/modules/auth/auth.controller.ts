import { Body, Controller, Get, Patch } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
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
}
