/* Migração única: JSON legado (web/data/*.json) -> PostgreSQL (Prisma).
   Uso: DATABASE_URL=postgresql://user:pass@host:5432/safeprint node scripts/migrate-json-to-pg.cjs
*/
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const DATA_DIR = path.join(process.cwd(), "data");
const prisma = new PrismaClient();

function readJson(name, fallback) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf-8"));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function toDate(v) { return v ? new Date(v) : null; }

async function main() {
  const jobs = readJson("jobs.json", []);
  for (const j of jobs) {
    await prisma.job.upsert({
      where: { id: j.id },
      create: {
        id: j.id, printerId: j.printerId, printerSlug: j.printerSlug, fileName: j.fileName ?? "documento",
        fileType: j.fileType ?? "pdf", pages: j.pages ?? [], copies: j.copies ?? 1, duplex: j.duplex ?? false,
        pagesPerSheet: j.pagesPerSheet ?? null, landscape: j.landscape ?? null, sheets: j.sheets ?? 0,
        totalCents: j.totalCents ?? 0, discountCents: j.discountCents ?? null, couponCode: j.couponCode ?? null,
        status: j.status ?? "awaiting_payment", createdAt: toDate(j.createdAt) ?? new Date(), expiresAt: toDate(j.expiresAt),
        claimedAt: toDate(j.claimedAt), claimToken: j.claimToken ?? null, customerPhone: j.customerPhone ?? null,
        fileDataUrl: j.fileDataUrl ?? null, mpPaymentId: j.mpPaymentId ?? null, mpStatus: j.mpStatus ?? null,
        mpQrBase64: j.mpQrBase64 ?? null, mpCopyPaste: j.mpCopyPaste ?? null, mpRefunded: j.mpRefunded ?? false,
        fileKey: j.fileKey ?? null,
      },
      update: {
        printerSlug: j.printerSlug, fileName: j.fileName ?? "documento", fileType: j.fileType ?? "pdf", pages: j.pages ?? [],
        copies: j.copies ?? 1, duplex: j.duplex ?? false, pagesPerSheet: j.pagesPerSheet ?? null,
        landscape: j.landscape ?? null, sheets: j.sheets ?? 0, totalCents: j.totalCents ?? 0, discountCents: j.discountCents ?? null,
        couponCode: j.couponCode ?? null, status: j.status ?? "awaiting_payment", expiresAt: toDate(j.expiresAt),
        claimedAt: toDate(j.claimedAt), claimToken: j.claimToken ?? null, customerPhone: j.customerPhone ?? null,
        fileDataUrl: j.fileDataUrl ?? null, mpPaymentId: j.mpPaymentId ?? null, mpStatus: j.mpStatus ?? null,
        mpQrBase64: j.mpQrBase64 ?? null, mpCopyPaste: j.mpCopyPaste ?? null, mpRefunded: j.mpRefunded ?? false, fileKey: j.fileKey ?? null,
      },
    });
  }

  const refunds = readJson("refunds.json", []);
  for (const r of refunds) {
    await prisma.refund.upsert({
      where: { id: r.id },
      create: { id: r.id, jobId: r.jobId, motive: r.motive, motiveLabel: r.motiveLabel ?? "", description: r.description ?? null, name: r.name ?? null, whatsapp: r.whatsapp ?? null, photoDataUrl: r.photoDataUrl ?? null, status: r.status ?? "open" },
      update: { jobId: r.jobId, motive: r.motive, motiveLabel: r.motiveLabel ?? "", description: r.description ?? null, name: r.name ?? null, whatsapp: r.whatsapp ?? null, photoDataUrl: r.photoDataUrl ?? null, status: r.status ?? "open" },
    });
  }

  const printers = readJson("printers.json", []);
  for (const p of printers) {
    await prisma.printer.upsert({
      where: { id: p.id },
      create: { id: p.id, slug: p.slug, code: p.code, name: p.name, location: p.location ?? null, address: p.address ?? null, status: p.status ?? "online", paperCurrent: p.paperCurrent ?? 0, paperCapacity: p.paperCapacity ?? 0, paperAlertAt: p.paperAlertAt ?? 50, tiers: p.tiers ?? [], colorAvailable: p.colorAvailable ?? false },
      update: { slug: p.slug, code: p.code, name: p.name, location: p.location ?? null, address: p.address ?? null, status: p.status ?? "online", paperCurrent: p.paperCurrent ?? 0, paperCapacity: p.paperCapacity ?? 0, paperAlertAt: p.paperAlertAt ?? 50, tiers: p.tiers ?? [], colorAvailable: p.colorAvailable ?? false },
    });
  }

  const meta = readJson("printers-meta.json", {});
  for (const [printerId, o] of Object.entries(meta ?? {})) {
    if (!o) continue;
    await prisma.printerMeta.upsert({
      where: { printerId },
      create: { id: printerId, printerId, code: o.code ?? null, status: o.status ?? null, paperCapacity: o.paperCapacity ?? null, paperAlertAt: o.paperAlertAt ?? null, tiers: o.tiers ?? null, name: o.name ?? null, location: o.location ?? null, address: o.address ?? null, lifetimeSheets: o.lifetimeSheets ?? null },
      update: { code: o.code ?? null, status: o.status ?? null, paperCapacity: o.paperCapacity ?? null, paperAlertAt: o.paperAlertAt ?? null, tiers: o.tiers ?? null, name: o.name ?? null, location: o.location ?? null, address: o.address ?? null, lifetimeSheets: o.lifetimeSheets ?? null },
    });
  }

  const config = readJson("config.json", null);
  if (config) {
    await prisma.config.upsert({
      where: { id: 1 },
      create: { id: 1, tiers: config.tiers ?? [], promo: config.promo ?? { enabled: false, title: "", description: "" }, coupons: config.coupons ?? [], site: config.site ?? {} },
      update: { tiers: config.tiers ?? [], promo: config.promo ?? { enabled: false, title: "", description: "" }, coupons: config.coupons ?? [], site: config.site ?? {} },
    });
  }

  const couponsUsed = readJson("coupons-used.json", []);
  for (const c of couponsUsed) { try { await prisma.couponUsed.upsert({ where: { code: String(c).toUpperCase() }, create: { code: String(c).toUpperCase() }, update: {} }); } catch {} }

  const sessions = readJson("sessions.json", []);
  for (const s of sessions) { try { await prisma.adminSession.create({ data: { token: s.token, role: s.role ?? "admin", createdAt: s.createdAt ? new Date(s.createdAt) : new Date(), expiresAt: new Date(s.expiresAt) } }); } catch {} }

  const security = readJson("security.json", { mfaEnabled: false });
  await prisma.securityState.upsert({
    where: { id: 1 },
    create: { id: 1, mfaEnabled: security.mfaEnabled ?? false, passwordHash: security.passwordHash ?? null, mfaSecret: security.mfaSecret ?? null },
    update: { mfaEnabled: security.mfaEnabled ?? false, passwordHash: security.passwordHash ?? null, mfaSecret: security.mfaSecret ?? null },
  });

  console.log("Migração JSON -> Postgres concluída.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
