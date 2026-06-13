import { Controller, Get } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import { MeService } from "./me.service";

@Controller()
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get("me")
  me(@Session() session: { user: Record<string, unknown> }) {
    return this.meService.getProfile(session.user);
  }
}
