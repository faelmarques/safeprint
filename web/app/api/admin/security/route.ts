import { NextResponse } from "next/server";
import { store, isAdmin } from "@/lib/store";
import { verifyAdminPassword, hashAdminPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { newMfaSecret, mfaUrl, readableSecret, verifyTotp } from "@/lib/totp";

// GET -> { mfaEnabled, sessions: [{ createdAt, expiresAt, current }] }
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const me = req.headers.get("x-admin-key") ?? "";
  const sec = await store.security.get();
  const sessions = await store.sessions.sweep();
  return NextResponse.json({
    mfaEnabled: sec.mfaEnabled && !!sec.mfaSecret,
    hasCustomPassword: !!sec.passwordHash,
    sessions: sessions.map((s) => ({
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      current: s.token === me,
      token: s.token === me ? s.token : `${s.token.slice(0, 8)}…`,
    })),
  });
}

export async function POST(req: Request) {
  const rl = rateLimit(req, "admin-security", 20, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const me = req.headers.get("x-admin-key") ?? "";
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === "change-password") {
    const cur = String(body.current ?? "");
    const next = String(body.next ?? "");
    if (!(await verifyAdminPassword(cur))) return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 });
    if (next.length < 8) return NextResponse.json({ error: "Nova senha: mínimo 8 caracteres" }, { status: 400 });
    await store.security.set({ passwordHash: await hashAdminPassword(next) });
    const sessions = await store.sessions.sweep();
    for (const s of sessions) {
      if (s.token !== me) await store.sessions.revoke(s.token);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "mfa-setup") {
    const secret = newMfaSecret();
    await store.security.set({ mfaSecret: secret, mfaEnabled: false });
    return NextResponse.json({ ok: true, secret: readableSecret(secret), url: mfaUrl(secret) });
  }

  if (action === "mfa-enable") {
    const sec = await store.security.get();
    if (!sec.mfaSecret) return NextResponse.json({ error: "Gere o segredo primeiro" }, { status: 400 });
    if (!(await verifyTotp(sec.mfaSecret, String(body.totp ?? "")))) {
      return NextResponse.json({ error: "Código inválido. Confira o app autenticador." }, { status: 400 });
    }
    await store.security.set({ mfaEnabled: true });
    return NextResponse.json({ ok: true });
  }

  if (action === "mfa-disable") {
    if (!(await verifyAdminPassword(String(body.password ?? "")))) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }
    await store.security.set({ mfaEnabled: false, mfaSecret: undefined });
    return NextResponse.json({ ok: true });
  }

  if (action === "revoke") {
    await store.sessions.revoke(String(body.token ?? ""));
    return NextResponse.json({ ok: true });
  }

  if (action === "revoke-others") {
    const sessions = await store.sessions.sweep();
    for (const s of sessions) {
      if (s.token !== me) await store.sessions.revoke(s.token);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
