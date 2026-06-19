import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import sharp from "sharp";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ORGANIZATION_LOGO_MAX_BYTES,
  ORGANIZATION_LOGO_MAX_HEIGHT,
  ORGANIZATION_LOGO_MAX_WIDTH,
  ORGANIZATION_LOGO_MIN_HEIGHT,
  ORGANIZATION_LOGO_MIN_WIDTH,
  organizationLogoObjectKey,
} from "./organization-logo.constants";
import { ObjectStorageService } from "./object-storage.service";

export interface ProcessedLogo {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
  key: string;
}

@Injectable()
export class OrganizationLogoService {
  constructor(
    private readonly storage: ObjectStorageService,
    private readonly prisma: PrismaService,
  ) {}

  assertCanManageLogo(user: CurrentUserPayload, organizationId: string): void {
    if (user.role === UserRole.super_admin) {
      return;
    }

    if (user.role === UserRole.admin && user.organizationId === organizationId) {
      return;
    }

    throw new ForbiddenException("You cannot manage this organization's logo");
  }

  async processUpload(file: Express.Multer.File): Promise<ProcessedLogo> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Logo file is required");
    }

    if (file.size > ORGANIZATION_LOGO_MAX_BYTES) {
      throw new BadRequestException("Logo must be 3MB or smaller");
    }

    const mime = file.mimetype?.toLowerCase();
    if (mime !== "image/jpeg" && mime !== "image/png") {
      throw new BadRequestException("Logo must be a PNG or JPEG image");
    }

    let image = sharp(file.buffer, { failOn: "none" });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException("Invalid image file");
    }

    if (
      metadata.width < ORGANIZATION_LOGO_MIN_WIDTH ||
      metadata.height < ORGANIZATION_LOGO_MIN_HEIGHT
    ) {
      throw new BadRequestException(
        `Logo must be at least ${ORGANIZATION_LOGO_MIN_WIDTH}×${ORGANIZATION_LOGO_MIN_HEIGHT} pixels`,
      );
    }

    image = image.resize({
      width: ORGANIZATION_LOGO_MAX_WIDTH,
      height: ORGANIZATION_LOGO_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    });

    const extension = mime === "image/png" ? "png" : "jpg";
    const buffer =
      extension === "png"
        ? await image.png({ compressionLevel: 9 }).toBuffer()
        : await image.jpeg({ quality: 88 }).toBuffer();

    return {
      buffer,
      contentType: extension === "png" ? "image/png" : "image/jpeg",
      extension,
      key: "",
    };
  }

  async uploadLogo(
    organizationId: string,
    user: CurrentUserPayload,
    file: Express.Multer.File,
  ) {
    this.assertCanManageLogo(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, logoKey: true },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with id "${organizationId}" not found`);
    }

    const processed = await this.processUpload(file);
    const key = organizationLogoObjectKey(organizationId, processed.extension);

    await this.purgeLogoStorage(organizationId, organization.logoKey);

    await this.storage.putObject(key, processed.buffer, processed.contentType);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        logoKey: key,
        logoUpdatedAt: new Date(),
      },
    });
  }

  async deleteLogo(organizationId: string, user: CurrentUserPayload) {
    this.assertCanManageLogo(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, logoKey: true },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with id "${organizationId}" not found`);
    }

    if (!organization.logoKey) {
      return this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
    }

    await this.purgeLogoStorage(organizationId, organization.logoKey);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        logoKey: null,
        logoUpdatedAt: null,
      },
    });
  }

  async getLogoObject(organizationId: string, user: CurrentUserPayload) {
    this.assertCanManageLogo(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoKey: true },
    });

    if (!organization?.logoKey) {
      throw new NotFoundException("Organization logo not found");
    }

    const object = await this.storage.getObject(organization.logoKey);
    if (!object) {
      throw new NotFoundException("Organization logo not found");
    }

    return object;
  }

  /** For future PDF export — internal use with org id only. */
  async getLogoBytesByOrganizationId(
    organizationId: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoKey: true },
    });

    if (!organization?.logoKey) {
      return null;
    }

    const object = await this.storage.getObject(organization.logoKey);
    if (!object) {
      return null;
    }

    return {
      buffer: object.body,
      contentType: object.contentType,
    };
  }

  /** Remove logo file(s) from R2/local — stored key plus jpg/png variants and legacy paths. */
  private async purgeLogoStorage(
    organizationId: string,
    logoKey?: string | null,
  ): Promise<void> {
    const keys = new Set(
      [
        logoKey,
        organizationLogoObjectKey(organizationId, "jpg"),
        organizationLogoObjectKey(organizationId, "png"),
      ].filter((key): key is string => Boolean(key)),
    );

    await Promise.all(
      [...keys].map((key) => this.storage.deleteObject(key)),
    );
  }
}
