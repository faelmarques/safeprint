import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getMpPayment } from "@/lib/mercadopago";
import { rateLimit } from "@/lib/ratelimit";

// Webhook Mercado Pago: configure em https://www.mercadopago.com.br/developers/panel
// URL: https://SEU-DOMINIO/api/webhooks/mercadopago (evento payment)
export async function POST(req: Request) {
  const rl = rateLimit(req, "mp-webhook", 120, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: true });
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const id =
    body?.data?.id ?? body?.id ?? url.searchParams.get("id") ?? url.searchParams.get("data.id");
  if (!id) return NextResponse.json({ ok: true });

  try {
    const { verifyWebhookSignature } = await import("@/lib/mercadopago");
    const sig = await verifyWebhookSignature(req, String(id));
    if (sig === false) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const data = await getMpPayment(id);
    if (String(data.status) === "approved") {
      const ref: string = String(data.external_reference ?? "");
      const ids = ref.split("|")[1]?.split(",") ?? [];
      const targets =
        ids.length > 0
          ? ids
          : store.jobs.all().filter((j) => Number(j.mpPaymentId) === Number(id)).map((j) => j.id);
      for (const jobId of targets) {
        const j = store.jobs.get(jobId);
        if (j && j.status === "awaiting_payment") {
          j.status = "queued";
          j.mpStatus = "approved";
          store.jobs.save(j);
        }
      }
    }
  } catch {
    // retorna 200 mesmo assim para o MP não re-tentar em loop agressivo
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
