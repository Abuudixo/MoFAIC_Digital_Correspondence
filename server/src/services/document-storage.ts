import { createReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, isAbsolute, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

const allowedExtensions = new Set([".pdf"]);
const storedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".txt"]);

export interface DocumentStorage {
  store(bytes: Buffer, extension: string): Promise<string>;
  assertAvailable(key: string): Promise<void>;
  open(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
}

export class PrivateLocalDocumentStorage implements DocumentStorage {
  private readonly root = resolve(env.DOCUMENT_STORAGE_DIR);

  constructor() {
    if (!isAbsolute(env.DOCUMENT_STORAGE_DIR)) {
      throw new Error("Document storage directory must be absolute.");
    }
  }

  private pathFor(key: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i.test(
        key,
      ) ||
      !storedExtensions.has(extname(key).toLowerCase())
    ) {
      throw new AppError(404, "Document was not found.");
    }
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) {
      throw new AppError(404, "Document was not found.");
    }
    return path;
  }

  async store(bytes: Buffer, extension: string) {
    if (!allowedExtensions.has(extension)) {
      throw new AppError(415, "This document file type is not supported.");
    }
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = `${randomUUID()}${extension}`;
    await writeFile(this.pathFor(key), bytes, { flag: "wx", mode: 0o600 });
    return key;
  }

  async open(key: string) {
    return createReadStream(this.pathFor(key));
  }

  async assertAvailable(key: string) {
    await access(this.pathFor(key));
  }

  async remove(key: string) {
    await unlink(this.pathFor(key));
  }
}

function isMissingObject(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  if ("name" in error && (error.name === "NotFound" || error.name === "NoSuchKey")) {
    return true;
  }
  if (!("$metadata" in error) || typeof error.$metadata !== "object" || !error.$metadata) {
    return false;
  }
  return (
    "httpStatusCode" in error.$metadata &&
    error.$metadata.httpStatusCode === 404
  );
}

export class CloudflareR2DocumentStorage implements DocumentStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
    if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("Cloudflare R2 storage configuration is incomplete.");
    }
    this.bucket = R2_BUCKET;
    this.client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async store(bytes: Buffer, extension: string) {
    if (!allowedExtensions.has(extension)) {
      throw new AppError(415, "This document file type is not supported.");
    }
    const key = `${randomUUID()}${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: "application/pdf",
      }),
    );
    return key;
  }

  async assertAvailable(key: string) {
    validateStorageKey(key);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (isMissingObject(error)) {
        throw new AppError(404, "Document content is unavailable.");
      }
      throw error;
    }
  }

  async open(key: string) {
    validateStorageKey(key);
    let response;
    try {
      response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (isMissingObject(error)) {
        throw new AppError(404, "Document content is unavailable.");
      }
      throw error;
    }
    if (!(response.Body instanceof Readable)) {
      throw new Error("Cloudflare R2 returned an unsupported document stream.");
    }
    return response.Body;
  }

  async remove(key: string) {
    validateStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

function validateStorageKey(key: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i.test(
      key,
    ) ||
    !storedExtensions.has(extname(key).toLowerCase())
  ) {
    throw new AppError(404, "Document was not found.");
  }
}

export const documentStorage: DocumentStorage =
  env.DOCUMENT_STORAGE_DRIVER === "r2"
    ? new CloudflareR2DocumentStorage()
    : new PrivateLocalDocumentStorage();

export function safeOriginalFileName(input: string) {
  const normalized = input.replaceAll("\\", "/").split("/").pop() ?? "";
  const safe = [...normalized]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 0x1f && codePoint !== 0x7f;
    })
    .join("")
    .trim();
  if (
    !safe ||
    safe === "." ||
    safe === ".." ||
    [...safe].length > 255 ||
    !allowedExtensions.has(extname(safe).toLowerCase())
  ) {
    throw new AppError(415, "Provide a PDF document.");
  }
  return safe;
}

export function detectDocumentType(fileName: string, bytes: Buffer) {
  const extension = extname(fileName).toLowerCase();
  if (extension === ".pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { extension, mimeType: "application/pdf" };
  }
  throw new AppError(415, "Only PDF documents are supported.");
}

export const maximumDocumentBytes = 10 * 1024 * 1024;
