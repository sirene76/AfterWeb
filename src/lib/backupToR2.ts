import AdmZip from "adm-zip";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface BackupResult {
  key: string;
  url: string;
  timestamp: string;
  size: number;
}

export interface BackupParams {
  websiteId: string;
  deployUrl: string;
}

function assertEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not set in the environment`);
  }
  return value;
}

export async function backupToR2({ websiteId, deployUrl }: BackupParams): Promise<BackupResult> {
  if (!deployUrl) {
    throw new Error("Cannot back up a website without a deployment URL");
  }

  const accessKeyId = assertEnv(process.env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID");
  const secretAccessKey = assertEnv(process.env.R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY");
  const bucket = assertEnv(process.env.R2_BACKUP_BUCKET, "R2_BACKUP_BUCKET");
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID;
  const endpoint = assertEnv(
    process.env.R2_ENDPOINT ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined),
    "R2_ENDPOINT",
  );

  const response = await fetch(deployUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download deployed site: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const zip = new AdmZip();
  zip.addFile("index.html", Buffer.from(html, "utf-8"));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `backups/${websiteId}/${timestamp}.zip`;
  const buffer = zip.toBuffer();

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "application/zip",
    }),
  );

  const publicBase =
    process.env.R2_PUBLIC_BASE_URL ??
    (accountId ? `https://${bucket}.${accountId}.r2.cloudflarestorage.com` : `${endpoint.replace(/\/$/, "")}/${bucket}`);

  return {
    key,
    url: `${publicBase}/${key}`,
    timestamp,
    size: buffer.length,
  };
}
