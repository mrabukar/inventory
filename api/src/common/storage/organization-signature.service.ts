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
  ORGANIZATION_SIGNATURE_MAX_BYTES,
  ORGANIZATION_SIGNATURE_MAX_HEIGHT,
  ORGANIZATION_SIGNATURE_MAX_WIDTH,
  ORGANIZATION_SIGNATURE_MIN_HEIGHT,
  ORGANIZATION_SIGNATURE_MIN_WIDTH,
  organizationSignatureObjectKey,
} from "./organization-signature.constants";
import { ObjectStorageService } from "./object-storage.service";

export interface ProcessedSignature {
  buffer: Buffer;
  contentType: "image/png";
  key: string;
}

@Injectable()
export class OrganizationSignatureService {
  constructor(
    private readonly storage: ObjectStorageService,
    private readonly prisma: PrismaService,
  ) {}

  assertCanManageSignature(
    user: CurrentUserPayload,
    organizationId: string,
  ): void {
    if (user.role === UserRole.super_admin) {
      return;
    }

    if (
      user.role === UserRole.admin &&
      user.organizationId === organizationId
    ) {
      return;
    }

    throw new ForbiddenException(
      "You cannot manage this organization's signature",
    );
  }

  async processUpload(file: Express.Multer.File): Promise<ProcessedSignature> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Signature is required");
    }

    if (file.size > ORGANIZATION_SIGNATURE_MAX_BYTES) {
      throw new BadRequestException("Signature must be 3MB or smaller");
    }

    const mime = file.mimetype?.toLowerCase();
    if (mime !== "image/png") {
      throw new BadRequestException("Signature must be a PNG image");
    }

    let image = sharp(file.buffer, { failOn: "none" });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException("Invalid signature image");
    }

    if (
      metadata.width < ORGANIZATION_SIGNATURE_MIN_WIDTH ||
      metadata.height < ORGANIZATION_SIGNATURE_MIN_HEIGHT
    ) {
      throw new BadRequestException(
        `Signature must be at least ${ORGANIZATION_SIGNATURE_MIN_WIDTH}×${ORGANIZATION_SIGNATURE_MIN_HEIGHT} pixels`,
      );
    }

    image = image.resize({
      width: ORGANIZATION_SIGNATURE_MAX_WIDTH,
      height: ORGANIZATION_SIGNATURE_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    });

    const buffer = await image.png({ compressionLevel: 9 }).toBuffer();

    return {
      buffer,
      contentType: "image/png",
      key: "",
    };
  }

  async uploadSignature(
    organizationId: string,
    user: CurrentUserPayload,
    file: Express.Multer.File,
  ) {
    this.assertCanManageSignature(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, signatureKey: true },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organization with id "${organizationId}" not found`,
      );
    }

    const processed = await this.processUpload(file);
    const key = organizationSignatureObjectKey(organizationId);

    await this.purgeSignatureStorage(organizationId, organization.signatureKey);

    await this.storage.putObject(key, processed.buffer, processed.contentType);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        signatureKey: key,
        signatureUpdatedAt: new Date(),
      },
    });
  }

  async deleteSignature(organizationId: string, user: CurrentUserPayload) {
    this.assertCanManageSignature(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, signatureKey: true },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organization with id "${organizationId}" not found`,
      );
    }

    if (!organization.signatureKey) {
      return this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
    }

    await this.purgeSignatureStorage(organizationId, organization.signatureKey);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        signatureKey: null,
        signatureUpdatedAt: null,
      },
    });
  }

  async getSignatureObject(organizationId: string, user: CurrentUserPayload) {
    this.assertCanManageSignature(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { signatureKey: true },
    });

    if (!organization?.signatureKey) {
      throw new NotFoundException("Organization signature not found");
    }

    const object = await this.storage.getObject(organization.signatureKey);
    if (!object) {
      throw new NotFoundException("Organization signature not found");
    }

    return object;
  }

  /** Remove signature file(s) from R2/local — stored key plus the canonical png path. */
  private async purgeSignatureStorage(
    organizationId: string,
    signatureKey?: string | null,
  ): Promise<void> {
    const keys = new Set(
      [signatureKey, organizationSignatureObjectKey(organizationId)].filter(
        (key): key is string => Boolean(key),
      ),
    );

    await Promise.all([...keys].map((key) => this.storage.deleteObject(key)));
  }
}
