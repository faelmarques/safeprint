import { createHmac, randomBytes } from "crypto";

// TOTP RFC 6238 (SHA1, 30s, 6 dígitos) sem dependências externas.
const STEP = 30;
const DIGITS = 6;

function counter(atMs: number): number {
  return Math.floor(atMs / 1000 / STEP);
}

function hotp(secret: Buffer, c: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(c));
  const h = createHmac("sha1", secret).update(buf).digest();
  const o = h[h.length - 1] & 0x0f;
  const code = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function newMfaSecret(): string {
  return randomBytes(20).toString("base64");
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer): string {
  let out = "";
  let bits = 0;
  let val = 0;
  for (let i = 0; i < buf.length; i++) {
    val = (val << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

export function mfaUrl(secretB64: string, account = "admin@safeprint", issuer = "SafePrint"): string {
  const secret = base32(Buffer.from(secretB64, "base64"));
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

export function readableSecret(secretB64: string): string {
  return base32(Buffer.from(secretB64, "base64")).match(/.{1,4}/g)?.join(" ") ?? "";
}

export function verifyTotp(secretB64: string, code: string, windowSteps = 1): boolean {
  const c = String(code ?? "").replace(/\D/g, "");
  if (c.length !== DIGITS) return false;
  try {
    const secret = Buffer.from(secretB64, "base64");
    const now = counter(Date.now());
    for (let d = -windowSteps; d <= windowSteps; d++) {
      if (hotp(secret, now + d) === c) return true;
    }
    return false;
  } catch {
    return false;
  }
}
