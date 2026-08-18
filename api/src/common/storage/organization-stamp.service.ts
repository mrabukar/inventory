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
  ORGANIZATION_STAMP_MAX_BYTES,
  ORGANIZATION_STAMP_MAX_HEIGHT,
  ORGANIZATION_STAMP_MAX_WIDTH,
  ORGANIZATION_STAMP_MIN_HEIGHT,
  ORGANIZATION_STAMP_MIN_WIDTH,
  organizationStampObjectKey,
} from "./organization-stamp.constants";
import { ObjectStorageService } from "./object-storage.service";

export interface ProcessedStamp {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
  key: string;
}

@Injectable()
export class OrganizationStampService {
  constructor(
    private readonly storage: ObjectStorageService,
    private readonly prisma: PrismaService,
  ) {}

  assertCanManageStamp(user: CurrentUserPayload, organizationId: string): void {
    if (user.role === UserRole.super_admin) {
      return;
    }

    if (
      user.role === UserRole.admin &&
      user.organizationId === organizationId
    ) {
      return;
    }

    throw new ForbiddenException("You cannot manage this organization's stamp");
  }

  async processUpload(file: Express.Multer.File): Promise<ProcessedStamp> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Stamp file is required");
    }

    if (file.size > ORGANIZATION_STAMP_MAX_BYTES) {
      throw new BadRequestException("Stamp must be 3MB or smaller");
    }

    const mime = file.mimetype?.toLowerCase();
    if (mime !== "image/jpeg" && mime !== "image/png") {
      throw new BadRequestException("Stamp must be a PNG or JPEG image");
    }

    let image = sharp(file.buffer, { failOn: "none" });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException("Invalid image file");
    }

    if (
      metadata.width < ORGANIZATION_STAMP_MIN_WIDTH ||
      metadata.height < ORGANIZATION_STAMP_MIN_HEIGHT
    ) {
      throw new BadRequestException(
        `Stamp must be at least ${ORGANIZATION_STAMP_MIN_WIDTH}×${ORGANIZATION_STAMP_MIN_HEIGHT} pixels`,
      );
    }

    image = image.resize({
      width: ORGANIZATION_STAMP_MAX_WIDTH,
      height: ORGANIZATION_STAMP_MAX_HEIGHT,
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

  async uploadStamp(
    organizationId: string,
    user: CurrentUserPayload,
    file: Express.Multer.File,
  ) {
    this.assertCanManageStamp(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, stampKey: true },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organization with id "${organizationId}" not found`,
      );
    }

    const processed = await this.processUpload(file);
    const key = organizationStampObjectKey(organizationId, processed.extension);

    await this.purgeStampStorage(organizationId, organization.stampKey);

    await this.storage.putObject(key, processed.buffer, processed.contentType);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        stampKey: key,
        stampUpdatedAt: new Date(),
      },
    });
  }

  async deleteStamp(organizationId: string, user: CurrentUserPayload) {
    this.assertCanManageStamp(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, stampKey: true },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organization with id "${organizationId}" not found`,
      );
    }

    if (!organization.stampKey) {
      return this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
    }

    await this.purgeStampStorage(organizationId, organization.stampKey);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        stampKey: null,
        stampUpdatedAt: null,
      },
    });
  }

  async getStampObject(organizationId: string, user: CurrentUserPayload) {
    this.assertCanManageStamp(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stampKey: true },
    });

    if (!organization?.stampKey) {
      throw new NotFoundException("Organization stamp not found");
    }

    const object = await this.storage.getObject(organization.stampKey);
    if (!object) {
      throw new NotFoundException("Organization stamp not found");
    }

    return object;
  }

  /** Remove stamp file(s) from R2/local — stored key plus jpg/png variants. */
  private async purgeStampStorage(
    organizationId: string,
    stampKey?: string | null,
  ): Promise<void> {
    const keys = new Set(
      [
        stampKey,
        organizationStampObjectKey(organizationId, "jpg"),
        organizationStampObjectKey(organizationId, "png"),
      ].filter((key): key is string => Boolean(key)),
    );

    await Promise.all([...keys].map((key) => this.storage.deleteObject(key)));
  }
}
