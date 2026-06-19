import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import type { Response } from "express";
import { memoryStorage } from "multer";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationLogoService } from "../../common/storage/organization-logo.service";
import { ORGANIZATION_LOGO_MAX_BYTES } from "../../common/storage/organization-logo.constants";

@Roles(UserRole.super_admin)
@Controller("organizations")
export class OrganizationsLogoController {
  constructor(private readonly organizationLogo: OrganizationLogoService) {}

  @Post(":id/logo")
  @UseInterceptors(
    FileInterceptor("logo", {
      storage: memoryStorage(),
      limits: { fileSize: ORGANIZATION_LOGO_MAX_BYTES },
    }),
  )
  uploadLogo(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.organizationLogo.uploadLogo(id, user, file);
  }

  @Delete(":id/logo")
  deleteLogo(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.organizationLogo.deleteLogo(id, user);
  }

  @Get(":id/logo")
  async getLogo(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const object = await this.organizationLogo.getLogoObject(id, user);
    res.setHeader("Content-Type", object.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(object.body);
  }
}
