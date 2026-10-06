import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { verifyAdminPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTotp } from "@/lib/totp";

function passwordOk(password: string): boolean {
  return verifyAdminPassword(password);
}

// POST { password, totp? } -> { ok, token } | { mfaRequired: true } | 401/429
export async function POST(req: Request) {
  const rl = rateLimit(req, "admin-login", 10, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
  const { password, totp } = await req.json().catch(() => ({}));
  if (!passwordOk(password)) return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });

  const sec = store.security.get();
  if (sec.mfaEnabled && sec.mfaSecret) {
    if (!verifyTotp(sec.mfaSecret, String(totp ?? ""))) {
      return NextResponse.json({ error: "Código MFA inválido", mfaRequired: true }, { status: 401 });
    }
  }
  const s = store.sessions.create();
  return NextResponse.json({ ok: true, token: s.token, expiresAt: s.expiresAt });
}
