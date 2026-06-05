import { Controller, Get } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Session } from "@thallesp/nestjs-better-auth";
import { SESSION_COOKIE_NAME } from "./auth.constants";

@ApiTags("Auth")
@Controller("api")
export class MeController {
  @Get("me")
  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiOperation({ summary: "Get the current authenticated user (alias)" })
  @ApiOkResponse({
    schema: { example: { user: { id: "...", email: "user@example.com" } } },
  })
  @ApiUnauthorizedResponse({
    schema: { example: { code: "UNAUTHORIZED", message: "Unauthorized" } },
  })
  me(@Session() session: { user: unknown }) {
    return { user: session.user };
  }
}
