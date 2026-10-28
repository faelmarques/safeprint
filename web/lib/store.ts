// Store via Prisma + PostgreSQL (Fase 1 — migração definitiva do JSON em disco).
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { PRINTERS, type Printer, type PriceTier } from "./printers";
import type { Job as JobRow, Refund as RefundRow, Config as ConfigRow, Printer as PrinterRow, PrinterMeta as PrinterMetaRow, AdminSession as AdminSessionRow, SecurityState as SecurityStateRow } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type JobStatus = "awaiting_payment" | "queued" | "printing" | "done" | "failed" | "expired";

export interface PrintJob {
  id: string;
  printerId: string;
  printerSlug: string;
  fileName: string;
  fileType: "pdf" | "image";
  pages: number[];
  copies: number;
  duplex: boolean;
  pagesPerSheet?: number;
  landscape?: boolean;
  sheets: number;
  totalCents: number;
  discountCents?: number;
  couponCode?: string;
  status: JobStatus;
  createdAt: string;
  expiresAt?: string; // awaiting_payment morre em 15min
  claimedAt?: string; // claim anti-duplo do agent
  claimToken?: string;
  customerPhone?: string; // WhatsApp (só dígitos, com DDD). Nunca exposto na API pública.
  fileDataUrl?: string; // Produção: URL S3 privada com expiração.
  mpPaymentId?: number;
  mpStatus?: string;
  mpQrBase64?: string;
  mpCopyPaste?: string;
  mpRefunded?: boolean;
  fileKey?: string; // storage S3/R2 (presigned PUT + public URL); null/undefined = legacy base64 em fileDataUrl
}

export type RefundMotive = "quantidade_incorreta" | "nao_saiu" | "saiu_falhada" | "outro";

export const REFUND_MOTIVES: { value: RefundMotive; label: string }[] = [
  { value: "quantidade_incorreta", label: "Não saiu a quantidade correta" },
  { value: "nao_saiu", label: "Não saiu a minha impressão" },
  { value: "saiu_falhada", label: "Minha impressão saiu falhada" },
  { value: "outro", label: "Outro" },
];

export interface RefundRequest {
  id: string;
  jobId: string;
  motive: RefundMotive;
  motiveLabel: string;
  description: string;
  name: string;
  whatsapp: string;
  photoDataUrl: string;
  status: "open" | "approved" | "rejected";
  createdAt: string;
}

export interface PaperState {
  [printerId: string]: number;
}

export interface PrinterOverride {
  status?: "online" | "offline" | "maintenance";
  code?: string;
  paperCapacity?: number;
  paperAlertAt?: number;
  tiers?: PriceTier[];
  name?: string;
  location?: string;
  address?: string;
  lifetimeSheets?: number;
}

export interface Coupon {
  code: string;
  percentOff: number; // 0-100
  active: boolean;
  singleUse?: boolean; // uso único global: queimado após o primeiro pedido
}

export interface PricingConfig {
  tiers: PriceTier[];
  promo: { enabled: boolean; title: string; description: string };
  coupons: Coupon[];
  site: SiteConfig;
}

export interface SiteConfig {
  siteName: string;
  tagline: string;
  heroBadge: string;
  heroTitle: string;
  heroSub: string;
  footerNote: string;
}

export interface AdminSession {
  token: string;
  role: "admin";
  createdAt: string;
  expiresAt: string;
}

export interface SecurityState {
  passwordHash?: string; // bcrypt; vazio = usa ADMIN_PASSWORD do ambiente
  mfaSecret?: string; // base64; vazio = MFA desligado
  mfaEnabled: boolean;
}

const DEFAULT_SITE: SiteConfig = {
  siteName: "SafePrint",
  tagline: "Impressão autoatendimento",
  heroBadge: "🎓 Novo no Unifacef • Franca/SP",
  heroTitle: "Imprima seu trabalho sem fila, sem papelaria.",
  heroSub: "Chegou na faculdade, lembrou do trabalho? Escaneie o QR da máquina, envie o PDF pelo celular, pague no Pix e retire na hora. Pronto em menos de 1 minuto.",
  footerNote: "*Horário conforme o local da máquina • Arquivos excluídos em 24h",
};

const DEFAULT_TIERS: PriceTier[] = [
  { minSheets: 1, pricePerSheetCents: 150 },
  { minSheets: 6, pricePerSheetCents: 135 },
  { minSheets: 11, pricePerSheetCents: 125 },
];

function mapJob(r: JobRow): PrintJob {
  return {
    id: r.id,
    printerId: r.printerId,
    printerSlug: r.printerSlug,
    fileName: r.fileName,
    fileType: r.fileType === "image" ? "image" : "pdf",
    pages: (r.pages ?? []) as number[],
    copies: r.copies,
    duplex: r.duplex,
    pagesPerSheet: r.pagesPerSheet ?? undefined,
    landscape: r.landscape ?? undefined,
    sheets: r.sheets,
    totalCents: r.totalCents,
    discountCents: r.discountCents ?? undefined,
    couponCode: r.couponCode ?? undefined,
    status: r.status as JobStatus,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString(),
    claimedAt: r.claimedAt?.toISOString(),
    claimToken: r.claimToken ?? undefined,
    customerPhone: r.customerPhone ?? undefined,
    fileDataUrl: r.fileDataUrl ?? undefined,
    mpPaymentId: r.mpPaymentId ?? undefined,
    mpStatus: r.mpStatus ?? undefined,
    mpQrBase64: r.mpQrBase64 ?? undefined,
    mpCopyPaste: r.mpCopyPaste ?? undefined,
    mpRefunded: r.mpRefunded ?? false,
    fileKey: r.fileKey ?? undefined,
  };
}

function mapRefund(r: RefundRow): RefundRequest {
  return {
    id: r.id,
    jobId: r.jobId,
    motive: r.motive as RefundMotive,
    motiveLabel: r.motiveLabel,
    description: r.description ?? "",
    name: r.name ?? "",
    whatsapp: r.whatsapp ?? "",
    photoDataUrl: r.photoDataUrl ?? "",
    status: (r.status === "approved" || r.status === "rejected" ? r.status : "open") as RefundRequest["status"],
    createdAt: r.createdAt.toISOString(),
  };
}

function mapPrinter(r: PrinterRow): Printer {
  return {
    id: r.id,
    slug: r.slug,
    code: r.code,
    name: r.name,
    location: r.location ?? "",
    address: r.address ?? "",
    status: (r.status === "online" || r.status === "offline" || r.status === "maintenance" ? r.status : "online") as Printer["status"],
    paperCurrent: r.paperCurrent,
    paperCapacity: r.paperCapacity,
    paperAlertAt: r.paperAlertAt,
    tiers: (r.tiers ?? DEFAULT_TIERS) as unknown as PriceTier[],
    colorAvailable: r.colorAvailable,
    lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
  };
}

function mapMeta(r: PrinterMetaRow): PrinterOverride {
  return {
    code: r.code ?? undefined,
    status: (r.status === "online" || r.status === "offline" || r.status === "maintenance" ? r.status : undefined),
    paperCapacity: r.paperCapacity ?? undefined,
    paperAlertAt: r.paperAlertAt ?? undefined,
    tiers: (r.tiers as PriceTier[] | null) ?? undefined,
    name: r.name ?? undefined,
    location: r.location ?? undefined,
    address: r.address ?? undefined,
    lifetimeSheets: r.lifetimeSheets ?? undefined,
  };
}

export async function isAdmin(req: Request): Promise<boolean> {
  const key = req.headers.get("x-admin-key") ?? "";
  const s = await store.sessions.valid(key);
  return s !== null;
}

export const store = {
  jobs: {
    all: async (): Promise<PrintJob[]> => {
      const rows = await prisma.job.findMany({ orderBy: { createdAt: "desc" } });
      return rows.map(mapJob);
    },
    get: async (id: string): Promise<PrintJob | undefined> => {
      const r = await prisma.job.findUnique({ where: { id } });
      return r ? mapJob(r) : undefined;
    },
    save: async (job: PrintJob): Promise<PrintJob> => {
      const r = await prisma.job.upsert({
        where: { id: job.id },
        create: {
          id: job.id,
          printerId: job.printerId,
          printerSlug: job.printerSlug,
          fileName: job.fileName,
          fileType: job.fileType,
          pages: job.pages as unknown as Prisma.InputJsonValue,
          copies: job.copies,
          duplex: job.duplex,
          pagesPerSheet: job.pagesPerSheet,
          landscape: job.landscape,
          sheets: job.sheets,
          totalCents: job.totalCents,
          discountCents: job.discountCents,
          couponCode: job.couponCode,
          status: job.status,
          createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
          expiresAt: job.expiresAt ? new Date(job.expiresAt) : undefined,
          claimedAt: job.claimedAt ? new Date(job.claimedAt) : undefined,
          claimToken: job.claimToken,
          customerPhone: job.customerPhone,
          fileDataUrl: job.fileDataUrl,
          mpPaymentId: job.mpPaymentId,
          mpStatus: job.mpStatus,
          mpQrBase64: job.mpQrBase64,
          mpCopyPaste: job.mpCopyPaste,
          mpRefunded: job.mpRefunded ?? false,
          fileKey: job.fileKey,
        } as Prisma.JobUncheckedCreateInput,
        update: {
          printerSlug: job.printerSlug,
          fileName: job.fileName,
          fileType: job.fileType,
          pages: job.pages as unknown as Prisma.InputJsonValue,
          copies: job.copies,
          duplex: job.duplex,
          pagesPerSheet: job.pagesPerSheet,
          landscape: job.landscape,
          sheets: job.sheets,
          totalCents: job.totalCents,
          discountCents: job.discountCents,
          couponCode: job.couponCode,
          status: job.status,
          expiresAt: job.expiresAt ? new Date(job.expiresAt) : undefined,
          claimedAt: job.claimedAt ? new Date(job.claimedAt) : undefined,
          claimToken: job.claimToken,
          customerPhone: job.customerPhone,
          fileDataUrl: job.fileDataUrl,
          mpPaymentId: job.mpPaymentId,
          mpStatus: job.mpStatus,
          mpQrBase64: job.mpQrBase64,
          mpCopyPaste: job.mpCopyPaste,
          mpRefunded: job.mpRefunded ?? false,
          fileKey: job.fileKey,
        } as Prisma.JobUncheckedUpdateInput,
      });
      return mapJob(r);
    },
    pendingForPrinter: async (printerId: string): Promise<PrintJob[]> => {
      await sweepExpired();
      const rows = await prisma.job.findMany({
        where: {
          OR: [
            { printerId, status: "queued" },
            { printerId, status: "printing", claimedAt: { lt: new Date(Date.now() - 3 * 60 * 1000) } },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(mapJob);
    },
    pub: (job: PrintJob) => {
      const { fileDataUrl: _drop, customerPhone: _phone, ...rest } = job;
      return rest;
    },
  },
  refunds: {
    all: async (): Promise<RefundRequest[]> => {
      const rows = await prisma.refund.findMany({ orderBy: { createdAt: "desc" } });
      return rows.map(mapRefund);
    },
    save: async (r: RefundRequest): Promise<RefundRequest> => {
      const row = await prisma.refund.create({
        data: {
          id: r.id,
          jobId: r.jobId,
          motive: r.motive,
          motiveLabel: r.motiveLabel,
          description: r.description,
          name: r.name,
          whatsapp: r.whatsapp,
          photoDataUrl: r.photoDataUrl,
          status: r.status,
        } as Prisma.RefundUncheckedCreateInput,
      });
      return mapRefund(row);
    },
    update: async (id: string, patch: Partial<RefundRequest>): Promise<RefundRequest | null> => {
      try {
        const row = await prisma.refund.update({ where: { id }, data: patch as Prisma.RefundUncheckedUpdateInput });
        return mapRefund(row);
      } catch {
        return null;
      }
    },
  },
  meta: {
    all: async (): Promise<Record<string, PrinterOverride>> => {
      const rows = await prisma.printerMeta.findMany();
      const m: Record<string, PrinterOverride> = {};
      for (const r of rows) m[r.printerId] = mapMeta(r);
      return m;
    },
    get: async (printerId: string): Promise<PrinterOverride> => {
      const r = await prisma.printerMeta.findUnique({ where: { printerId } });
      return r ? mapMeta(r) : {};
    },
    set: async (printerId: string, patch: PrinterOverride): Promise<PrinterOverride> => {
      const r = await prisma.printerMeta.upsert({
        where: { printerId },
        create: { id: printerId, printerId, code: patch.code, status: patch.status, paperCapacity: patch.paperCapacity, paperAlertAt: patch.paperAlertAt, tiers: patch.tiers as unknown as Prisma.InputJsonValue, name: patch.name, location: patch.location, address: patch.address, lifetimeSheets: patch.lifetimeSheets },
        update: { code: patch.code, status: patch.status, paperCapacity: patch.paperCapacity, paperAlertAt: patch.paperAlertAt, tiers: patch.tiers as unknown as Prisma.InputJsonValue, name: patch.name, location: patch.location, address: patch.address, lifetimeSheets: patch.lifetimeSheets },
      });
      return mapMeta(r);
    },
  },
  config: {
    get: async (): Promise<PricingConfig> => {
      const fallback: PricingConfig = {
        tiers: DEFAULT_TIERS,
        promo: { enabled: false, title: "", description: "" },
        coupons: [],
        site: DEFAULT_SITE,
      };
      const r = await prisma.config.findUnique({ where: { id: 1 } });
      if (!r) return fallback;
      return {
        tiers: (r.tiers as unknown as PriceTier[]) ?? DEFAULT_TIERS,
        promo: (r.promo as PricingConfig["promo"]) ?? fallback.promo,
        coupons: (r.coupons as unknown as Coupon[]) ?? [],
        site: { ...DEFAULT_SITE, ...(r.site as unknown as SiteConfig) },
      };
    },
    set: async (c: PricingConfig): Promise<PricingConfig> => {
      const r = await prisma.config.upsert({
        where: { id: 1 },
        create: { id: 1, tiers: c.tiers as unknown as Prisma.InputJsonValue, promo: c.promo as unknown as Prisma.InputJsonValue, coupons: c.coupons as unknown as Prisma.InputJsonValue, site: c.site as unknown as Prisma.InputJsonValue },
        update: { tiers: c.tiers as unknown as Prisma.InputJsonValue, promo: c.promo as unknown as Prisma.InputJsonValue, coupons: c.coupons as unknown as Prisma.InputJsonValue, site: c.site as unknown as Prisma.InputJsonValue },
      });
      return {
        tiers: (r.tiers as unknown as PriceTier[]) ?? DEFAULT_TIERS,
        promo: (r.promo as PricingConfig["promo"]) ?? { enabled: false, title: "", description: "" },
        coupons: (r.coupons as unknown as Coupon[]) ?? [],
        site: { ...DEFAULT_SITE, ...(r.site as unknown as SiteConfig) },
      };
    },
  },
  printers: {
    all: async (): Promise<Printer[]> => {
      const rows = await prisma.printer.findMany({ orderBy: { id: "asc" } });
      if (rows.length === 0) {
        await prisma.printer.createMany({
          data: PRINTERS.map((p) => ({
            id: p.id,
            slug: p.slug,
            code: p.code,
            name: p.name,
            location: p.location,
            address: p.address,
            status: p.status,
            paperCurrent: p.paperCurrent,
            paperCapacity: p.paperCapacity,
            paperAlertAt: p.paperAlertAt,
            tiers: p.tiers as unknown as Prisma.InputJsonValue,
            colorAvailable: p.colorAvailable,
          })),
        });
        return [...PRINTERS];
      }
      return rows.map(mapPrinter);
    },
    get: async (idOrSlug: string): Promise<Printer | undefined> => {
      const r = await prisma.printer.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });
      return r ? mapPrinter(r) : undefined;
    },
    save: async (p: Printer): Promise<Printer> => {
      const r = await prisma.printer.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          slug: p.slug,
          code: p.code,
          name: p.name,
          location: p.location,
          address: p.address,
          status: p.status,
          paperCurrent: p.paperCurrent,
          paperCapacity: p.paperCapacity,
          paperAlertAt: p.paperAlertAt,
          tiers: p.tiers as unknown as Prisma.InputJsonValue,
          colorAvailable: p.colorAvailable,
        } as Prisma.PrinterUncheckedCreateInput,
        update: {
          slug: p.slug,
          code: p.code,
          name: p.name,
          location: p.location,
          address: p.address,
          status: p.status,
          paperCurrent: p.paperCurrent,
          paperCapacity: p.paperCapacity,
          paperAlertAt: p.paperAlertAt,
          tiers: p.tiers as unknown as Prisma.InputJsonValue,
          colorAvailable: p.colorAvailable,
        } as Prisma.PrinterUncheckedUpdateInput,
      });
      return mapPrinter(r);
    },
    remove: async (id: string): Promise<boolean> => {
      const r = await prisma.printer.delete({ where: { id } }).catch(() => null);
      return !!r;
    },
    touchHeartbeat: async (id: string): Promise<Printer | undefined> => {
      const r = await prisma.printer.update({ where: { id }, data: { lastSeenAt: new Date() } });
      return mapPrinter(r);
    },
  },
  couponsUsed: {
    all: async (): Promise<string[]> => {
      const rows = await prisma.couponUsed.findMany({ select: { code: true } });
      return rows.map((r) => r.code);
    },
    has: async (code: string): Promise<boolean> => !!(await prisma.couponUsed.findUnique({ where: { code } })),
    burn: async (code: string): Promise<void> => {
      const c = code.trim().toUpperCase();
      await prisma.couponUsed.upsert({ where: { code: c }, create: { code: c }, update: {} });
    },
  },
  paper: {
    get: async (printerId: string, fallback = 200): Promise<number> => {
      const p = await prisma.printer.findUnique({ where: { id: printerId } });
      return p?.paperCurrent ?? fallback;
    },
    set: async (printerId: string, qty: number): Promise<void> => {
      await prisma.printer.update({ where: { id: printerId }, data: { paperCurrent: qty } });
    },
    consume: async (printerId: string, sheets: number, fallback = 200): Promise<number> => {
      const p = await prisma.printer.findUnique({ where: { id: printerId } });
      const cur = p?.paperCurrent ?? fallback;
      const next = Math.max(0, cur - sheets);
      await prisma.printer.update({ where: { id: printerId }, data: { paperCurrent: next } });
      return next;
    },
  },
  security: {
    get: async (): Promise<SecurityState> => {
      const r = await prisma.securityState.findUnique({ where: { id: 1 } });
      return r
        ? { passwordHash: r.passwordHash ?? undefined, mfaSecret: r.mfaSecret ?? undefined, mfaEnabled: r.mfaEnabled }
        : { mfaEnabled: false };
    },
    set: async (patch: Partial<SecurityState>): Promise<SecurityState> => {
      const r = await prisma.securityState.upsert({
        where: { id: 1 },
        create: { id: 1, mfaEnabled: false },
        update: { passwordHash: patch.passwordHash, mfaSecret: patch.mfaSecret, mfaEnabled: patch.mfaEnabled },
      });
      return { passwordHash: r.passwordHash ?? undefined, mfaSecret: r.mfaSecret ?? undefined, mfaEnabled: r.mfaEnabled };
    },
  },
  sessions: {
    ttlMs: 12 * 60 * 60 * 1000,
    all: async (): Promise<AdminSession[]> => {
      const rows = await prisma.adminSession.findMany({ orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ token: r.token, role: "admin" as const, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() }));
    },
    sweep: async (): Promise<AdminSession[]> => {
      const now = new Date();
      const alive = await prisma.adminSession.findMany({ where: { expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } });
      const dead = await prisma.adminSession.findMany({ where: { expiresAt: { lte: now } } });
      if (dead.length) await prisma.adminSession.deleteMany({ where: { token: { in: dead.map((d) => d.token) } } });
      return alive.map((r) => ({ token: r.token, role: "admin" as const, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() }));
    },
    create: async (): Promise<AdminSession> => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + store.sessions.ttlMs);
      const s: AdminSession = {
        token: randomBytes(32).toString("hex"),
        role: "admin",
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      const r = await prisma.adminSession.create({ data: { token: s.token, role: "admin", createdAt: now, expiresAt } });
      return { token: r.token, role: "admin" as const, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() };
    },
    valid: async (token: string): Promise<AdminSession | null> => {
      if (!token) return null;
      const r = await prisma.adminSession.findFirst({ where: { token, expiresAt: { gt: new Date() } } });
      if (!r) return null;
      return { token: r.token, role: "admin" as const, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() };
    },
    revoke: async (token: string): Promise<void> => {
      await prisma.adminSession.deleteMany({ where: { token } });
    },
    revokeAll: async (): Promise<void> => {
      await prisma.adminSession.deleteMany({});
    },
  },
};

export async function effectiveTiers(printerId: string, fallback: PriceTier[]): Promise<PriceTier[]> {
  const meta = await store.meta.get(printerId);
  if (Array.isArray(meta.tiers) && meta.tiers.length) return meta.tiers;
  const cfg = await store.config.get();
  return cfg.tiers.length ? cfg.tiers : fallback;
}

export async function notifyLowPaper(printerName: string, remaining: number) {
  return notifyTelegram(`🧻 SafePrint: papel baixo em "${printerName}" — restam ${remaining} folhas. Recarregue!`);
}

export async function notifyPaused(printerName: string, reason: string) {
  return notifyTelegram(`⛔ SafePrint: "${printerName}" pausada automaticamente (${reason}). Vendas interrompidas até recarregar.`);
}

async function notifyTelegram(msg: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log("[NOTIFY STUB]", msg);
    return { sent: false, reason: "TELEGRAM_* não configurado (stub em log)" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg }),
    });
    if (!res.ok) return { sent: false, reason: `HTTP ${res.status}` };
    return { sent: true };
  } catch (e) {
    console.error(e);
    return { sent: false, reason: String(e) };
  }
}

export async function listPrinters(): Promise<Printer[]> {
  const list = await store.printers.all();
  const metaMap = await store.meta.all();
  const out: Printer[] = [];
  for (const p of list) {
    const o = metaMap[p.id] ?? {};
    const fresh = p.lastSeenAt ? Date.now() - new Date(p.lastSeenAt).getTime() < 5 * 60 * 1000 : false;
    out.push({
      ...p,
      status: o.status ?? (fresh ? "online" : "offline"),
      paperCapacity: o.paperCapacity ?? p.paperCapacity,
      paperAlertAt: o.paperAlertAt ?? p.paperAlertAt,
      name: o.name ?? p.name,
      location: o.location ?? p.location,
      address: o.address ?? p.address,
      code: o.code ?? p.code,
      paperCurrent: await store.paper.get(p.id, p.paperCurrent),
    });
  }
  return out;
}

export async function findPrinter(idOrSlug: string | null): Promise<Printer | undefined> {
  if (!idOrSlug) return undefined;
  const list = await listPrinters();
  return list.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
}

export async function sweepExpired(): Promise<number> {
  const now = new Date();
  const expired = await prisma.job.findMany({ where: { status: "awaiting_payment", expiresAt: { lt: now } } });
  for (const j of expired) {
    await prisma.job.update({ where: { id: j.id }, data: { status: "expired", fileDataUrl: null, fileKey: null } });
    if (j.fileKey) {
      const { removeObject } = await import("./storage");
      await removeObject(j.fileKey);
    }
  }
  return expired.length;
}

export async function autoPauseIfEmpty(printerId: string, printerName: string, remaining: number): Promise<boolean> {
  if (remaining > 0) return false;
  const m = await store.meta.get(printerId);
  if (m.status === "maintenance") return true;
  await store.meta.set(printerId, { status: "maintenance" });
  await notifyPaused(printerName, "sem papel");
  return true;
}
