import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store } from "@/lib/store";
import { rateLimit } from "@/lib/ratelimit";
import { createPixPayment, mpEnabled } from "@/lib/mercadopago";

// Cria cobrança Pix no Mercado Pago para 1+ jobs (soma os totais).
// POST { jobIds: string[], payerEmail?: string }
export async function POST(req: Request) {
  const rl = rateLimit(req, "pix-create", 20, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Muitas tentativas. Tente em ${rl.retryAfter}s.` }, { status: 429 });
  if (!mpEnabled()) return NextResponse.json({ error: "Pix automático não configurado (sem MERCADOPAGO_ACCESS_TOKEN)" }, { status: 503 });

  const { jobIds, payerEmail } = await req.json().catch(() => ({}));
  if (!Array.isArray(jobIds) || !jobIds.length) return NextResponse.json({ error: "Sem pedidos" }, { status: 400 });

  const jobs = jobIds.map((id: string) => store.jobs.get(id)).filter((j): j is NonNullable<typeof j> => Boolean(j));
  if (!jobs.length) return NextResponse.json({ error: "Pedidos não encontrados" }, { status: 404 });
  if (jobs.some((j) => j.status !== "awaiting_payment")) {
    return NextResponse.json({ error: "Algum pedido já foi pago ou expirou. Refaça o pedido." }, { status: 409 });
  }

  const totalCents = jobs.reduce((s: number, j) => s + (j.totalCents ?? 0), 0);
  const ref = `sp-${uuid().slice(0, 8)}`;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const notificationUrl = base ? `${base}/api/webhooks/mercadopago` : undefined;

  try {
    const mp = await createPixPayment({
      amountReais: totalCents / 100,
      description: `SafePrint ${jobs.length} pedido(s) ${jobs[0]?.sheets ?? 0} fls`,
      externalReference: `${ref}|${jobs.map((j) => j.id).join(",")}`,
      payerEmail,
      notificationUrl,
    });
    for (const j of jobs) {
      j.mpPaymentId = mp.id;
      j.mpStatus = mp.status;
      j.mpQrBase64 = mp.qrBase64;
      j.mpCopyPaste = mp.qrCode;
      store.jobs.save(j);
    }
    return NextResponse.json({ paymentId: mp.id, status: mp.status, qrBase64: mp.qrBase64, copyPaste: mp.qrCode, totalCents });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erro no Pix" }, { status: 502 });
  }
}

// Consulta status (para polling no front quando webhook atrasar).
// GET /api/payments/pix?paymentId=123
export async function GET(req: Request) {
  const rl = rateLimit(req, "pix-status", 60, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas consultas. Aguarde." }, { status: 429 });
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("paymentId");
  if (!paymentId) return NextResponse.json({ error: "paymentId obrigatório" }, { status: 400 });
  const { getMpPayment } = await import("@/lib/mercadopago");
  try {
    const data = await getMpPayment(paymentId);
    if (String(data.status) === "approved") {
      const ref: string = String(data.external_reference ?? "");
      const ids = ref.split("|")[1]?.split(",") ?? [];
      for (const id of ids) {
        const j = store.jobs.get(id);
        if (j && j.status === "awaiting_payment") {
          j.status = "queued";
          j.mpStatus = "approved";
          store.jobs.save(j);
        }
      }
    }
    return NextResponse.json({ status: data.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
