import { NextResponse } from "next/server";
import { store, sweepExpired } from "@/lib/store";
import { rateLimit } from "@/lib/ratelimit";

// Status público do pedido (sem bytes do arquivo) + posição na fila.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const rl = rateLimit(req, "job-status", 120, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas consultas" }, { status: 429 });
  sweepExpired();
  const job = store.jobs.get(params.id);
  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const queueAhead = store.jobs
    .all()
    .filter(
      (j) =>
        j.printerId === job.printerId &&
        (j.status === "queued" || j.status === "printing") &&
        j.createdAt < job.createdAt
    ).length;
  return NextResponse.json({ job: store.jobs.pub(job), queueAhead });
}

// Cancela apenas enquanto não foi pago (awaiting_payment/expirado).
// Pedido pago (queued) só via estorno no /admin — evita calote com Pix recebido.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const rl = rateLimit(req, "job-cancel", 30, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });
  const job = store.jobs.get(params.id);
  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (job.status !== "awaiting_payment" && job.status !== "expired") {
    return NextResponse.json({ error: "Pedido já pago: solicite reembolso no painel" }, { status: 409 });
  }
  job.status = "failed";
  job.fileDataUrl = undefined;
  store.jobs.save(job);
  return NextResponse.json({ ok: true });
}
