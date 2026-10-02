import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getPrinterBySlug } from "@/lib/printers";
import { calcSheets, calcTotal } from "@/lib/pricing";
import { store, effectiveTiers, type PrintJob } from "@/lib/store";
import { rateLimit } from "@/lib/ratelimit";
import { checkDataUrl } from "@/lib/filefilter";

export async function POST(req: Request) {
  const rl = rateLimit(req, "jobs-post", 30, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Muitos pedidos seguidos. Tente em ${rl.retryAfter}s.` }, { status: 429 });
  const body = await req.json();
  const { printerSlug, fileName, fileType, pages, copies, fileDataUrl, pagesPerSheet, landscape, couponCode } = body;

  const printer = getPrinterBySlug(printerSlug);
  if (!printer) return NextResponse.json({ error: "Impressora não encontrada" }, { status: 404 });
  const liveStatus = store.meta.get(printer.id).status ?? printer.status;
  if (liveStatus !== "online") return NextResponse.json({ error: "Impressora offline no momento" }, { status: 409 });
  if (!pages?.length) return NextResponse.json({ error: "Selecione ao menos 1 página" }, { status: 400 });
  if (fileType === "image" && fileDataUrl) {
    const imgErr = checkDataUrl(fileDataUrl, "image");
    if (imgErr) return NextResponse.json({ error: imgErr }, { status: 400 });
  }

  // Impressora somente frente: 1 página por folha (sem duplex)
  const perSheet = [1, 2, 4, 6, 9].includes(Number(pagesPerSheet)) ? Number(pagesPerSheet) : 1;
  const sheets = calcSheets(pages.length, copies ?? 1, false, perSheet);
  let { totalCents } = calcTotal(sheets, effectiveTiers(printer.id, printer.tiers));

  // cupom de desconto
  let discountCents = 0;
  let appliedCoupon: string | undefined;
  if (typeof couponCode === "string" && couponCode.trim()) {
    const c = store.config.get().coupons?.find((x) => x.active && x.code.trim().toUpperCase() === couponCode.trim().toUpperCase());
    if (!c) return NextResponse.json({ error: "Cupom inválido ou expirado" }, { status: 400 });
    discountCents = Math.floor((totalCents * Math.min(100, Math.max(0, c.percentOff))) / 100);
    appliedCoupon = c.code.toUpperCase();
    totalCents = Math.max(0, totalCents - discountCents);
  }

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
    pagesPerSheet: perSheet,
    landscape: Boolean(landscape),
    sheets,
    totalCents,
    discountCents,
    couponCode: appliedCoupon,
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
