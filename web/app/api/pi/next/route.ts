import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store, notifyLowPaper, autoPauseIfEmpty, listPrinters } from "@/lib/store";
import { publicUrl } from "@/lib/storage";
import { decDataUrl } from "@/lib/crypto";

async function merged(printerId: string) {
  const base = (await listPrinters()).find((p) => p.id === printerId || p.slug === printerId);
  if (!base) return null;
  const o = await store.meta.get(base.id);
  const paperCurrent = await store.paper.get(base.id, base.paperCurrent);
  return {
    ...base,
    code: o.code ?? base.code,
    status: o.status ?? base.status,
    paperCapacity: o.paperCapacity ?? base.paperCapacity,
    paperAlertAt: o.paperAlertAt ?? base.paperAlertAt,
    name: o.name ?? base.name,
    location: o.location ?? base.location,
    address: o.address ?? base.address,
    paperCurrent,
  };
}

// Chave do Pi: obrigatória em produção, opcional em dev.
function piAuth(req: Request): boolean {
  const need = process.env.PI_API_KEY;
  if (!need) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-pi-key") === need;
}

// Pi faz polling: GET /api/pi/next?printerSlug=xxx
// Marca o job como printing (claim anti-duplo) antes de entregar.
export async function GET(req: Request) {
  if (!piAuth(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("printerSlug") ?? searchParams.get("printerId");
  const printer = await merged(slug ?? "");
  if (!printer) return NextResponse.json({ error: "printer desconhecida" }, { status: 404 });
  if (printer.status !== "online") {
    return NextResponse.json({ printer, jobs: [] });
  }
  const pending = (await store.jobs.pendingForPrinter(printer.id)).slice(0, 1);
  for (const j of pending) {
    j.status = "printing";
    j.claimedAt = new Date().toISOString();
    j.claimToken = uuid();
    await store.jobs.save(j);
  }
  // entrega: com fileKey (S3/R2) devolve URL publica; sem ele, mantem o base64 descriptografado
  const jobs = pending.map((j) => {
    const out: any = { ...j, fileDataUrl: decDataUrl(j.fileDataUrl) };
    if (j.fileKey) out.fileUrl = publicUrl(j.fileKey);
    return out;
  });
  return NextResponse.json({ printer, jobs });
}

// Pi confirma: POST { jobId, ok: true } — idempotente (re-confirm não consome 2x)
export async function POST(req: Request) {
  if (!piAuth(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { jobId, ok } = await req.json();
  const job = await store.jobs.get(jobId);
  if (!job) return NextResponse.json({ error: "job não encontrado" }, { status: 404 });
  const printer = await merged(job.printerId);

  if (job.status === "done") return NextResponse.json({ job, duplicate: true });
  if (job.status === "failed") return NextResponse.json({ job, duplicate: true });

  if (ok === false) {
    job.status = "failed";
    await store.jobs.save(job);
    // Estorno automático: recebeu Pix mas não imprimiu -> devolve sem abrir o MP
    try {
      if (job.mpPaymentId && job.mpStatus === "approved" && !job.mpRefunded) {
        const { refundMpPayment, mpEnabled } = await import("@/lib/mercadopago");
        if (mpEnabled()) {
          await refundMpPayment(job.mpPaymentId);
          job.mpRefunded = true;
          await store.jobs.save(job);
          return NextResponse.json({ job, refunded: true });
        }
      }
    } catch (e) {
      console.error("auto-refund falhou:", e);
    }
    return NextResponse.json({ job, refunded: false });
  }

  job.status = "done";
  await store.jobs.save(job);

  if (printer) {
    const prevLife = (await store.meta.get(printer.id)).lifetimeSheets ?? 0;
    await store.meta.set(printer.id, { lifetimeSheets: prevLife + job.sheets });
    const remaining = await store.paper.consume(printer.id, job.sheets, printer.paperCapacity);
    const paused = await autoPauseIfEmpty(printer.id, printer.name, remaining);
    let notified = null;
    if (!paused && remaining <= printer.paperAlertAt) {
      notified = await notifyLowPaper(printer.name, remaining);
    }
    return NextResponse.json({ job, paperRemaining: remaining, paused, notified });
  }
  return NextResponse.json({ job });
}
