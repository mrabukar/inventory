import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface StoredObject {
  body: Buffer;
  contentType: string;
}

@Injectable()
export class ObjectStorageService {
  private readonly s3: S3Client | null;
  private readonly bucket: string | null;
  private readonly localRoot: string;
  private readonly useLocal: boolean;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("R2_SECRET_ACCESS_KEY");
    const endpoint = this.config.get<string>("R2_ENDPOINT");
    this.bucket = this.config.get<string>("R2_BUCKET") ?? null;

    const hasR2 =
      Boolean(accountId) &&
      Boolean(accessKeyId) &&
      Boolean(secretAccessKey) &&
      Boolean(endpoint) &&
      Boolean(this.bucket);

    this.useLocal = !hasR2;
    this.localRoot =
      this.config.get<string>("STORAGE_LOCAL_PATH") ??
      path.join(process.cwd(), "uploads");

    if (!hasR2) {
      this.s3 = null;
      return;
    }

    this.s3 = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
      },
    });
  }

  isLocalFallback(): boolean {
    return this.useLocal;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (this.useLocal) {
      const filePath = this.localPathForKey(key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, body);
      return;
    }

    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<StoredObject | null> {
    if (this.useLocal) {
      try {
        const body = await readFile(this.localPathForKey(key));
        return {
          body,
          contentType: key.endsWith(".png") ? "image/png" : "image/jpeg",
        };
      } catch {
        return null;
      }
    }

    const response = await this.s3!.send(
      new GetObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      }),
    );

    if (!response.Body) {
      return null;
    }

    const bytes = await response.Body.transformToByteArray();
    return {
      body: Buffer.from(bytes),
      contentType: response.ContentType ?? "application/octet-stream",
    };
  }

  async deleteObject(key: string): Promise<void> {
    for (const candidate of this.deleteKeyCandidates(key)) {
      await this.deleteObjectOnce(candidate);
    }
  }

  /** Keys to remove — includes legacy path when R2_ENDPOINT wrongly included the bucket name. */
  private deleteKeyCandidates(key: string): string[] {
    const candidates = [key];
    if (!this.useLocal && this.bucket) {
      const legacyKey = `${this.bucket}/${key}`;
      if (legacyKey !== key) {
        candidates.push(legacyKey);
      }
    }
    return candidates;
  }

  private async deleteObjectOnce(key: string): Promise<void> {
    if (this.useLocal) {
      try {
        await unlink(this.localPathForKey(key));
      } catch {
        // ignore missing local files
      }
      return;
    }

    await this.s3!.send(
      new DeleteObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      }),
    );
  }

  private localPathForKey(key: string): string {
    return path.join(this.localRoot, key);
  }
}
