import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createUploadUrl, storageEnabled } from "@/lib/storage";
import { rateLimit } from "@/lib/ratelimit";

// Gera URL presigned PUT (S3/R2) para o cliente enviar o arquivo direto.
// POST { fileName, contentType, jobId? } -> { url, key, expiresIn }
export async function POST(req: Request) {
  const rl = rateLimit(req, "uploads-create", 30, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Muitas tentativas. Tente em ${rl.retryAfter}s.` }, { status: 429 });
  if (!storageEnabled()) return NextResponse.json({ error: "Storage não configurado" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const fileName = String(body.fileName ?? "").trim().slice(0, 120);
  const contentType = String(body.contentType ?? "application/octet-stream");
  if (!fileName) return NextResponse.json({ error: "fileName obrigatório" }, { status: 400 });
  const jobId = typeof body.jobId === "string" && body.jobId.trim() ? body.jobId.trim() : null;
  const key = jobId ? `jobs/${jobId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}` : `uploads/${randomUUID()}/${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { url, key: resolvedKey } = await createUploadUrl({ key, contentType });
  return NextResponse.json({ url, key: resolvedKey, expiresIn: 300 });
}
