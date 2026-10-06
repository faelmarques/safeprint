import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const hex = (process.env.FILE_ENC_KEY ?? "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
  return null;
}

export function encReady(): boolean {
  return key() !== null;
}

// Criptografa dataURLs (documentos/fotos) antes de gravar no JSON.
// Sem FILE_ENC_KEY configurado, devolve como está (dev).
export function encDataUrl(dataUrl: string | undefined): string | undefined {
  if (!dataUrl) return dataUrl;
  const k = key();
  if (!k) return dataUrl;
  if (dataUrl.startsWith(PREFIX)) return dataUrl;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(dataUrl, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ct.toString("hex")}`;
}

export function decDataUrl(stored: string | undefined): string | undefined {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const k = key();
  if (!k) return undefined; // sem chave não há como ler (fail-closed)
  try {
    const [, ivHex, tagHex, ctHex] = stored.split(":");
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}
