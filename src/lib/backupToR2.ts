import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function backupToR2(siteUrl: string, websiteId: string) {
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const res = await fetch(siteUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  const key = `backups/${websiteId}/${Date.now()}.zip`;
  await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key, Body: buffer }));
  return `https://${process.env.R2_BUCKET_NAME!}.r2.cloudflarestorage.com/${key}`;
}
