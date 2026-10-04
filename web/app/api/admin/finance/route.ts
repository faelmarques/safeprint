import { NextResponse } from "next/server";
import { store, isAdmin } from "@/lib/store";
import { getMpPayment, refundMpPayment, mpEnabled } from "@/lib/mercadopago";

// Central financeira: lista pagamentos Pix + permite estornar sem abrir o MP.
// GET -> { jobs: [...], totals }
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const jobs = store.jobs
    .all()
    .filter((j) => j.mpPaymentId || j.status !== "awaiting_payment")
    .slice(0, 100);
  const paid = jobs.filter((j) => j.mpStatus === "approved" || j.status === "queued" || j.status === "done");
  const refunded = jobs.filter((j) => j.mpRefunded);
  return NextResponse.json({
    mpEnabled: mpEnabled(),
    totals: {
      receivedCents: paid.reduce((s, j) => s + (j.totalCents ?? 0), 0),
      refundedCents: refunded.reduce((s, j) => s + (j.totalCents ?? 0), 0),
      count: jobs.length,
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      fileName: j.fileName,
      sheets: j.sheets,
      totalCents: j.totalCents,
      status: j.status,
      createdAt: j.createdAt,
      printerSlug: j.printerSlug,
      mpPaymentId: j.mpPaymentId,
      mpStatus: j.mpStatus,
      mpRefunded: !!j.mpRefunded,
    })),
  });
}

// POST { jobId } -> estorna o Pix no MP e marca o job
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!mpEnabled()) return NextResponse.json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }, { status: 503 });
  const { jobId } = await req.json().catch(() => ({}));
  const job = store.jobs.get(jobId);
  if (!job?.mpPaymentId) return NextResponse.json({ error: "Pedido sem pagamento Pix" }, { status: 404 });
  if (job.mpRefunded) return NextResponse.json({ error: "Já estornado" }, { status: 409 });
  try {
    const live = await getMpPayment(job.mpPaymentId);
    if (String(live.status) !== "approved") {
      return NextResponse.json({ error: `Pix ainda não aprovado (status ${live.status})` }, { status: 409 });
    }
    await refundMpPayment(job.mpPaymentId);
    job.mpRefunded = true;
    if (job.status === "queued") job.status = "failed";
    store.jobs.save(job);
    return NextResponse.json({ ok: true, job });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erro no estorno" }, { status: 502 });
  }
}
