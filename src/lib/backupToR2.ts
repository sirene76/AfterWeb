import AdmZip from "adm-zip";
import fs from "fs/promises";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";

export type BackupResult = {
  objectKey: string;
  sizeBytes: number;
  fileName: string;
};

const requiredEnv = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_ENDPOINT"] as const;

function assertEnv() {
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var ${key}`);
    }
  }
}

function getS3Client() {
  assertEnv();
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function httpRequestToUrl(request: HttpRequest): string {
  const protocol = request.protocol ?? "https:";
  const hostname = request.hostname;
  const port = request.port ? `:${request.port}` : "";
  const pathName = request.path?.startsWith("/") ? request.path! : `/${request.path ?? ""}`;
  const baseUrl = `${protocol}//${hostname}${port}`;
  const url = new URL(pathName, baseUrl);

  if (request.query) {
    for (const [key, value] of Object.entries(request.query)) {
      if (value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => url.searchParams.append(key, entry));
      } else {
        url.searchParams.append(key, value);
      }
    }
  }

  return url.toString();
}

export async function backupToR2(websiteId: string, sourceDir: string): Promise<BackupResult> {
  if (!websiteId) {
    throw new Error("Missing website id for backup");
  }
  if (!sourceDir) {
    throw new Error("Missing source directory for backup");
  }

  assertEnv();

  const stats = await fs.stat(sourceDir);
  if (!stats.isDirectory()) {
    throw new Error(`Source directory ${sourceDir} is not a folder`);
  }

  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir);
  const buffer = zip.toBuffer();
  const fileName = `${websiteId}-${Date.now()}.zip`;
  const objectKey = `backups/${websiteId}/${fileName}`;

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: objectKey,
      Body: buffer,
      ContentType: "application/zip",
      ContentLength: buffer.length,
    }),
  );

  return { objectKey, sizeBytes: buffer.length, fileName };
}

export async function getBackupDownloadUrl(objectKey: string, expiresInSeconds = 600): Promise<string> {
  if (!objectKey) {
    throw new Error("Missing backup object key");
  }

  assertEnv();

  const endpoint = process.env.R2_ENDPOINT!;
  const bucket = process.env.R2_BUCKET_NAME!;
  const endpointUrl = new URL(endpoint);
  const signer = new SignatureV4({
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    service: "s3",
    region: "auto",
    sha256: Sha256,
    uriEscapePath: false,
  });

  const encodedKey = encodeKey(objectKey);
  const request = new HttpRequest({
    protocol: endpointUrl.protocol,
    hostname: endpointUrl.hostname,
    port: endpointUrl.port,
    method: "GET",
    path: `/${bucket}/${encodedKey}`,
    headers: {
      host: endpointUrl.hostname,
    },
  });

  const signed = await signer.presign(request, { expiresIn: expiresInSeconds });
  return httpRequestToUrl(signed);
}
