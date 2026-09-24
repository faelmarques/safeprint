import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getPrinterBySlug } from "@/lib/printers";
import { calcSheets, calcTotal } from "@/lib/pricing";
import { store, type PrintJob } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json();
  const { printerSlug, fileName, fileType, pages, copies, fileDataUrl } = body;

  const printer = getPrinterBySlug(printerSlug);
  if (!printer) return NextResponse.json({ error: "Impressora não encontrada" }, { status: 404 });
  const liveStatus = store.meta.get(printer.id).status ?? printer.status;
  if (liveStatus !== "online") return NextResponse.json({ error: "Impressora offline no momento" }, { status: 409 });
  if (!pages?.length) return NextResponse.json({ error: "Selecione ao menos 1 página" }, { status: 400 });

  // Impressora somente frente: 1 página por folha (sem duplex)
  const sheets = calcSheets(pages.length, copies ?? 1, false);
  const { totalCents } = calcTotal(sheets, printer.tiers);

  const remaining = store.paper.get(printer.id, printer.paperCurrent);
  if (sheets > remaining) {
    return NextResponse.json({ error: `Papel insuficiente na máquina (restam ${remaining}). Tente menos folhas.` }, { status: 409 });
  }

  const job: PrintJob = {
    id: uuid(),
    printerId: printer.id,
    printerSlug: printer.slug,
    fileName: fileName ?? "documento",
    fileType: fileType === "image" ? "image" : "pdf",
    pages,
    copies: copies ?? 1,
    duplex: false,
    sheets,
    totalCents,
    status: "awaiting_payment",
    createdAt: new Date().toISOString(),
    fileDataUrl: fileDataUrl?.slice(0, 2_000_000), // limite MVP 2MB base64
  };
  store.jobs.save(job);
  return NextResponse.json({ job });
}

// Simula confirmação de pagamento Pix (Mercado Pago entra aqui)
export async function PUT(req: Request) {
  const { jobId } = await req.json();
  const job = store.jobs.get(jobId);
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  job.status = "queued";
  store.jobs.save(job);
  return NextResponse.json({ job });
}
