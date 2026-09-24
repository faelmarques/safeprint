import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  if (password && password === (process.env.ADMIN_PASSWORD || "admin")) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
}
