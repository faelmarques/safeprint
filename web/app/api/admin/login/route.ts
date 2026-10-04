import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const rl = rateLimit(req, "admin-login", 10, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    // sem senha configurada: só permite o default em desenvolvimento
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "ADMIN_PASSWORD não configurado" }, { status: 503 });
    }
    if (password === "admin") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }
  if (password && password === expected) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
}
