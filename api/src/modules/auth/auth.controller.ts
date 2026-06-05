import { Controller, Get } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";

@Controller()
export class MeController {
  @Get("me")
  me(@Session() session: { user: unknown }) {
    return { user: session.user };
  }
}
