import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
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
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { OrganizationLogoService } from "../../common/storage/organization-logo.service";
import { ORGANIZATION_LOGO_MAX_BYTES } from "../../common/storage/organization-logo.constants";
import { OrganizationStampService } from "../../common/storage/organization-stamp.service";
import { ORGANIZATION_STAMP_MAX_BYTES } from "../../common/storage/organization-stamp.constants";
import { OrganizationSignatureService } from "../../common/storage/organization-signature.service";
import { ORGANIZATION_SIGNATURE_MAX_BYTES } from "../../common/storage/organization-signature.constants";
import { OrganizationsService } from "../organizations/organizations.service";
import { UpdateCurrentOrganizationDto } from "./dto/update-current-organization.dto";

@Roles(UserRole.admin)
@Controller("organization")
export class OrganizationBrandingController {
  constructor(
    private readonly organizationLogo: OrganizationLogoService,
    private readonly organizationStamp: OrganizationStampService,
    private readonly organizationSignature: OrganizationSignatureService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get()
  getCurrent(@CurrentUser() user: CurrentUserPayload) {
    return this.organizationsService.findCurrent(user);
  }

  @Patch()
  updateCurrent(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCurrentOrganizationDto,
  ) {
    return this.organizationsService.updateCurrent(user, dto);
  }

  @Post("logo")
  @UseInterceptors(
    FileInterceptor("logo", {
      storage: memoryStorage(),
      limits: { fileSize: ORGANIZATION_LOGO_MAX_BYTES },
    }),
  )
  uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    return this.organizationLogo.uploadLogo(organizationId, user, file);
  }

  @Delete("logo")
  deleteLogo(@CurrentUser() user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    return this.organizationLogo.deleteLogo(organizationId, user);
  }

  @Get("logo")
  async getLogo(@CurrentUser() user: CurrentUserPayload, @Res() res: Response) {
    const organizationId = requireOrganizationId(user);
    const object = await this.organizationLogo.getLogoObject(
      organizationId,
      user,
    );
    res.setHeader("Content-Type", object.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(object.body);
  }

  @Post("stamp")
  @UseInterceptors(
    FileInterceptor("stamp", {
      storage: memoryStorage(),
      limits: { fileSize: ORGANIZATION_STAMP_MAX_BYTES },
    }),
  )
  uploadStamp(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    return this.organizationStamp.uploadStamp(organizationId, user, file);
  }

  @Delete("stamp")
  deleteStamp(@CurrentUser() user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    return this.organizationStamp.deleteStamp(organizationId, user);
  }

  @Get("stamp")
  async getStamp(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const organizationId = requireOrganizationId(user);
    const object = await this.organizationStamp.getStampObject(
      organizationId,
      user,
    );
    res.setHeader("Content-Type", object.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(object.body);
  }

  @Post("signature")
  @UseInterceptors(
    FileInterceptor("signature", {
      storage: memoryStorage(),
      limits: { fileSize: ORGANIZATION_SIGNATURE_MAX_BYTES },
    }),
  )
  uploadSignature(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    return this.organizationSignature.uploadSignature(
      organizationId,
      user,
      file,
    );
  }

  @Delete("signature")
  deleteSignature(@CurrentUser() user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    return this.organizationSignature.deleteSignature(organizationId, user);
  }

  @Get("signature")
  async getSignature(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const organizationId = requireOrganizationId(user);
    const object = await this.organizationSignature.getSignatureObject(
      organizationId,
      user,
    );
    res.setHeader("Content-Type", object.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(object.body);
  }
}
