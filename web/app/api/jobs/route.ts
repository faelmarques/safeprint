import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { calcSheets, calcTotal } from "@/lib/pricing";
import { store, effectiveTiers, sweepExpired, findPrinter, type PrintJob } from "@/lib/store";
import { rateLimit } from "@/lib/ratelimit";
import { checkDataUrl } from "@/lib/filefilter";

// Conta páginas do PDF via /Count (mesma heurística do front). 0 = indeterminado.
function countPdfPages(dataUrl: string): number {
  try {
    const b64 = dataUrl.split(",", 2)[1] ?? "";
    const text = Buffer.from(b64, "base64").toString("latin1");
    let best = 0;
    const re = /\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) best = Math.max(best, Number(m[1]));
    return best;
  } catch {
    return 0;
  }
}

export async function POST(req: Request) {
  const rl = rateLimit(req, "jobs-post", 30, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Muitos pedidos seguidos. Tente em ${rl.retryAfter}s.` }, { status: 429 });
  sweepExpired();
  const body = await req.json();
  const { printerSlug, fileName, fileType, pages, fileDataUrl, pagesPerSheet, landscape, couponCode } = body;
  const copies = Math.min(100, Math.max(1, Number(body.copies ?? 1) || 1));

  const printer = findPrinter(printerSlug);
  if (!printer) return NextResponse.json({ error: "Impressora não encontrada" }, { status: 404 });
  const liveStatus = store.meta.get(printer.id).status ?? printer.status;
  if (liveStatus !== "online") return NextResponse.json({ error: "Impressora offline no momento" }, { status: 409 });
  if (!pages?.length) return NextResponse.json({ error: "Selecione ao menos 1 página" }, { status: 400 });
  if (pages.length > 100) return NextResponse.json({ error: "Máximo 100 páginas por arquivo" }, { status: 400 });
  if (fileType === "image" && fileDataUrl) {
    const imgErr = checkDataUrl(fileDataUrl, "image");
    if (imgErr) return NextResponse.json({ error: imgErr }, { status: 400 });
  }
  if (fileType !== "image" && fileDataUrl) {
    const pdfErr = checkDataUrl(fileDataUrl, "pdf");
    if (pdfErr) return NextResponse.json({ error: pdfErr }, { status: 400 });
  }
  if (fileDataUrl && fileDataUrl.length > 2_000_000) {
    return NextResponse.json({ error: "Arquivo grande demais para envio direto (limite ~1,5 MB). Comprima ou use imagem." }, { status: 413 });
  }
  // Validação server-side: páginas pedidas não podem exceder o total real do PDF (client mente)
  if (fileType !== "image" && fileDataUrl) {
    const total = countPdfPages(fileDataUrl);
    if (total > 0) {
      if (pages.some((p: number) => p < 1 || p > total)) {
        return NextResponse.json({ error: `PDF tem ${total} página(s). Ajuste o intervalo.` }, { status: 400 });
      }
    }
  }

  // Impressora somente frente: 1 página por folha (sem duplex)
  const perSheet = [1, 2, 4, 6, 9].includes(Number(pagesPerSheet)) ? Number(pagesPerSheet) : 1;
  const sheets = calcSheets(pages.length, copies, false, perSheet);
  let { totalCents } = calcTotal(sheets, effectiveTiers(printer.id, printer.tiers));

  // cupom de desconto
  let discountCents = 0;
  let appliedCoupon: string | undefined;
  if (typeof couponCode === "string" && couponCode.trim()) {
    const c = store.config.get().coupons?.find((x) => x.active && x.code.trim().toUpperCase() === couponCode.trim().toUpperCase());
    if (!c) return NextResponse.json({ error: "Cupom inválido ou expirado" }, { status: 400 });
    if (c.singleUse && store.couponsUsed.has(c.code)) {
      return NextResponse.json({ error: "Cupom de uso único já utilizado" }, { status: 400 });
    }
    discountCents = Math.floor((totalCents * Math.min(100, Math.max(0, c.percentOff))) / 100);
    appliedCoupon = c.code.toUpperCase();
    totalCents = Math.max(0, totalCents - discountCents);
  }

  const remaining = store.paper.get(printer.id, printer.paperCurrent);
  if (remaining < 150) {
    return NextResponse.json({ error: `Máquina com pouco papel (restam ${remaining}). Recarga necessária antes de novos pedidos.` }, { status: 409 });
  }
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
    copies,
    duplex: false,
    pagesPerSheet: perSheet,
    landscape: Boolean(landscape),
    sheets,
    totalCents,
    discountCents,
    couponCode: appliedCoupon,
    status: "awaiting_payment",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    fileDataUrl,
  };
  store.jobs.save(job);
  if (appliedCoupon) {
    const c = store.config.get().coupons?.find((x) => x.code.toUpperCase() === appliedCoupon);
    if (c?.singleUse) store.couponsUsed.burn(appliedCoupon);
  }
  return NextResponse.json({ job });
}

// Confirmação de pagamento: em produção SÓ via Pix (webhook/polling).
// O mock direto existe apenas para dev sem MERCADOPAGO_ACCESS_TOKEN.
export async function PUT(req: Request) {
  const { mpEnabled } = await import("@/lib/mercadopago");
  if (mpEnabled()) return NextResponse.json({ error: "Use o Pix para liberar a impressão" }, { status: 403 });
  const { jobId } = await req.json();
  const job = store.jobs.get(jobId);
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  job.status = "queued";
  store.jobs.save(job);
  return NextResponse.json({ job });
}
