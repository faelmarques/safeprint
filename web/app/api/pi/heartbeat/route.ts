import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { rateLimit } from "@/lib/ratelimit";

// Heartbeat do Pi: o agente manda a cada ~30s (HEARTBEAT_SECONDS) com o printerSlug.
// Atualiza lastSeenAt em Printer e devolve o estado atual (online/offline).
export async function POST(req: Request) {
  const rl = rateLimit(req, "pi-heartbeat", 60, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Muitas tentativas. Tente em ${rl.retryAfter}s.` }, { status: 429 });
  const need = process.env.PI_API_KEY;
  const authed = !need || req.headers.get("x-pi-key") === need;
  if (!authed) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const printer = await store.printers.get(String(body.printerId ?? body.printerSlug ?? ""));
  if (!printer) return NextResponse.json({ error: "printer desconhecida" }, { status: 404 });
  const p = await store.printers.touchHeartbeat(printer.id);
  return NextResponse.json({ ok: true, printer: p ?? printer });
}
