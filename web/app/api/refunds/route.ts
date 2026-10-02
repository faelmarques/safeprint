import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store, isAdmin, REFUND_MOTIVES, type RefundMotive, type RefundRequest } from "@/lib/store";
import { rateLimit } from "@/lib/ratelimit";
import { checkDataUrl } from "@/lib/filefilter";

export async function POST(req: Request) {
  const rl = rateLimit(req, "refunds-post", 10, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Muitas solicitações. Tente em ${rl.retryAfter}s.` }, { status: 429 });
  const { jobId, motive, description, name, whatsapp, photoDataUrl } = await req.json();
  const job = store.jobs.get(jobId);
  if (!job) return NextResponse.json({ error: "Pedido de impressão não encontrado" }, { status: 404 });

  const motiveOpt = REFUND_MOTIVES.find((m) => m.value === motive);
  if (!motiveOpt) return NextResponse.json({ error: "Escolha o motivo do problema" }, { status: 400 });
  if (!String(description ?? "").trim()) return NextResponse.json({ error: "Explique o que aconteceu" }, { status: 400 });
  if (!String(name ?? "").trim()) return NextResponse.json({ error: "Informe seu nome completo" }, { status: 400 });
  const phone = String(whatsapp ?? "").replace(/\D/g, "");
  if (phone.length < 10) return NextResponse.json({ error: "Informe um WhatsApp válido com DDD" }, { status: 400 });
  if (!photoDataUrl) return NextResponse.json({ error: "Envie a foto da impressão com defeito" }, { status: 400 });
  const photoErr = checkDataUrl(String(photoDataUrl), "image");
  if (photoErr) return NextResponse.json({ error: photoErr }, { status: 400 });

  const r: RefundRequest = {
    id: uuid(),
    jobId,
    motive: motive as RefundMotive,
    motiveLabel: motiveOpt.label,
    description: String(description).trim().slice(0, 1000),
    name: String(name).trim().slice(0, 120),
    whatsapp: phone.slice(0, 13),
    photoDataUrl: String(photoDataUrl).slice(0, 2_000_000),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  store.refunds.save(r);
  return NextResponse.json({ refund: r, message: `Recebido, ${r.name.split(" ")[0]}! Vamos analisar e te chamar no WhatsApp para o reembolso via Pix.` });
}

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ refunds: store.refunds.all() });
}

// Operador aprova/recusa: PUT { id, status: "approved" | "rejected" }
export async function PUT(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, status } = await req.json();
  if (!["approved", "rejected", "open"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }
  const r = store.refunds.update(id, { status });
  if (!r) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ refund: r });
}
