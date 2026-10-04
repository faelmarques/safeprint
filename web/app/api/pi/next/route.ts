import { NextResponse } from "next/server";
import { PRINTERS } from "@/lib/printers";
import { store, notifyLowPaper } from "@/lib/store";

function merged(printerId: string) {
  const base = PRINTERS.find((p) => p.id === printerId || p.slug === printerId);
  if (!base) return null;
  const o = store.meta.get(base.id);
  return {
    ...base,
    status: o.status ?? base.status,
    paperCapacity: o.paperCapacity ?? base.paperCapacity,
    paperAlertAt: o.paperAlertAt ?? base.paperAlertAt,
    name: o.name ?? base.name,
    location: o.location ?? base.location,
    address: o.address ?? base.address,
    paperCurrent: store.paper.get(base.id, base.paperCurrent),
  };
}

// Pi faz polling: GET /api/pi/next?printerSlug=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("printerSlug") ?? searchParams.get("printerId");
  const printer = merged(slug ?? "");
  if (!printer) return NextResponse.json({ error: "printer desconhecida" }, { status: 404 });
  if (printer.status !== "online") {
    return NextResponse.json({ printer, jobs: [] });
  }
  const jobs = store.jobs.pendingForPrinter(printer.id).slice(0, 1);
  return NextResponse.json({ printer, jobs });
}

// Pi confirma: POST { jobId, ok: true }
export async function POST(req: Request) {
  const { jobId, ok } = await req.json();
  const job = store.jobs.get(jobId);
  if (!job) return NextResponse.json({ error: "job não encontrado" }, { status: 404 });
  const printer = merged(job.printerId);

  if (ok === false) {
    job.status = "failed";
    store.jobs.save(job);
    // Estorno automático: recebeu Pix mas não imprimiu -> devolve sem abrir o MP
    try {
      if (job.mpPaymentId && job.mpStatus === "approved" && !job.mpRefunded) {
        const { refundMpPayment, mpEnabled } = await import("@/lib/mercadopago");
        if (mpEnabled()) {
          await refundMpPayment(job.mpPaymentId);
          job.mpRefunded = true;
          store.jobs.save(job);
          return NextResponse.json({ job, refunded: true });
        }
      }
    } catch (e) {
      console.error("auto-refund falhou:", e);
    }
    return NextResponse.json({ job, refunded: false });
  }

  job.status = "done";
  store.jobs.save(job);

  if (printer) {
    const prevLife = store.meta.get(printer.id).lifetimeSheets ?? 0;
    store.meta.set(printer.id, { lifetimeSheets: prevLife + job.sheets });
    const remaining = store.paper.consume(printer.id, job.sheets, printer.paperCapacity);
    let notified = null;
    if (remaining <= printer.paperAlertAt) {
      notified = await notifyLowPaper(printer.name, remaining);
    }
    return NextResponse.json({ job, paperRemaining: remaining, notified });
  }
  return NextResponse.json({ job });
}
