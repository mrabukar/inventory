import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { AppService } from "./app.service";

@ApiTags("Meta")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @AllowAnonymous()
  @Get()
  @ApiOperation({ summary: "API information" })
  @ApiOkResponse({
    schema: {
      example: { name: "Inventory API", version: "0.1.0", docs: "/api/docs" },
    },
  })
  getInfo(): { name: string; version: string; docs: string } {
    return this.appService.getInfo();
  }
}
