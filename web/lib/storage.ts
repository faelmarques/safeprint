import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
      forcePathStyle: true,
    });
  }
  return client;
}

// Storage S3/R2 ativo: exige bucket + credenciais. Sem isso, cai no fluxo legacy (base64).
export function storageEnabled(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export async function createUploadUrl(opts: { key: string; contentType: string; expiresIn?: number }): Promise<{ url: string; key: string }> {
  const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: process.env.S3_BUCKET ?? "", Key: opts.key, ContentType: opts.contentType }), { expiresIn: opts.expiresIn ?? 300 });
  return { url, key: opts.key };
}

export function publicUrl(key: string): string {
  const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function removeObject(key: string): Promise<void> {
  if (!storageEnabled() || !key) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET ?? "", Key: key }));
  } catch {
    // best effort: falha de storage não pode derrubar o fluxo de expiração
  }
}
