// Store em memória + JSON para MVP.
// Trocar por Postgres/Prisma em produção sem mudar a API das rotas.
import fs from "fs";
import path from "path";
import type { Printer } from "./printers";
import { PRINTERS } from "./printers";

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
  fileDataUrl?: string; // MVP: base64 pequeno. Produção: URL S3 privada com expiração.
  mpPaymentId?: number;
  mpStatus?: string;
  mpQrBase64?: string;
  mpCopyPaste?: string;
  mpRefunded?: boolean;
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
  tiers?: import("./printers").PriceTier[];
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
  tiers: import("./printers").PriceTier[];
  promo: { enabled: boolean; title: string; description: string };
  coupons: Coupon[];
  site: SiteConfig;
}

export function isAdmin(req: Request): boolean {
  const key = req.headers.get("x-admin-key") ?? "";
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return key !== "" && key === "admin" && process.env.NODE_ENV !== "production";
  return key !== "" && key === expected;
}

const DATA_DIR = path.join(process.cwd(), "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const REFUNDS_FILE = path.join(DATA_DIR, "refunds.json");
const PAPER_FILE = path.join(DATA_DIR, "paper.json");
const META_FILE = path.join(DATA_DIR, "printers-meta.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const PRINTERS_FILE = path.join(DATA_DIR, "printers.json");
const COUPONS_USED_FILE = path.join(DATA_DIR, "coupons-used.json");

export interface SiteConfig {
  siteName: string;
  tagline: string;
  heroBadge: string;
  heroTitle: string;
  heroSub: string;
  footerNote: string;
}

const DEFAULT_SITE: SiteConfig = {
  siteName: "SafePrint",
  tagline: "Impressão autoatendimento",
  heroBadge: "🎓 Novo no Unifacef • Franca/SP",
  heroTitle: "Imprima seu trabalho sem fila, sem papelaria.",
  heroSub: "Chegou na faculdade, lembrou do trabalho? Escaneie o QR da máquina, envie o PDF pelo celular, pague no Pix e retire na hora. Pronto em menos de 1 minuto.",
  footerNote: "*Horário conforme o local da máquina • Arquivos excluídos em 24h",
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, "[]");
  if (!fs.existsSync(REFUNDS_FILE)) fs.writeFileSync(REFUNDS_FILE, "[]");
  if (!fs.existsSync(PAPER_FILE)) fs.writeFileSync(PAPER_FILE, JSON.stringify({ "printer-unifacef-01": 200, "printer-demo-centro": 180 }));
  if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");
  if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    tiers: [
      { minSheets: 1, pricePerSheetCents: 150 },
      { minSheets: 6, pricePerSheetCents: 135 },
      { minSheets: 11, pricePerSheetCents: 125 },
    ],
    promo: { enabled: false, title: "", description: "" },
    coupons: [],
    site: DEFAULT_SITE,
  }, null, 2));
  if (!fs.existsSync(PRINTERS_FILE)) fs.writeFileSync(PRINTERS_FILE, JSON.stringify(PRINTERS, null, 2));
  if (!fs.existsSync(COUPONS_USED_FILE)) fs.writeFileSync(COUPONS_USED_FILE, "[]");
}

function read<T>(f: string, fallback: T): T {
  try {
    ensure();
    return JSON.parse(fs.readFileSync(f, "utf-8")) as T;
  } catch {
    return fallback;
  }
}
function write(f: string, v: unknown) {
  ensure();
  // escrita atômica: nunca deixa JSON meio-escrito num crash/queda de luz
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2));
  fs.renameSync(tmp, f);
}

export const store = {
  jobs: {
    all(): PrintJob[] { return read<PrintJob[]>(JOBS_FILE, []); },
    get(id: string) { return read<PrintJob[]>(JOBS_FILE, []).find((j) => j.id === id); },
    save(job: PrintJob) {
      const all = read<PrintJob[]>(JOBS_FILE, []);
      const i = all.findIndex((j) => j.id === job.id);
      if (i >= 0) all[i] = job; else all.unshift(job);
      write(JOBS_FILE, all);
    },
    pendingForPrinter(printerId: string): PrintJob[] {
      sweepExpired();
      const now = Date.now();
      return read<PrintJob[]>(JOBS_FILE, []).filter((j) => {
        if (j.printerId !== printerId) return false;
        if (j.status === "queued") return true;
        // reclaim: claim travado (crash do agent) volta pra fila após 3min
        if (j.status === "printing" && j.claimedAt && now - Date.parse(j.claimedAt) > 3 * 60 * 1000) return true;
        return false;
      });
    },
    // visão pública: sem bytes do arquivo
    pub(job: PrintJob) {
      const { fileDataUrl: _drop, ...rest } = job;
      return rest;
    },
  },
  refunds: {
    all(): RefundRequest[] { return read<RefundRequest[]>(REFUNDS_FILE, []); },
    save(r: RefundRequest) {
      const all = read<RefundRequest[]>(REFUNDS_FILE, []);
      all.unshift(r);
      write(REFUNDS_FILE, all);
    },
    update(id: string, patch: Partial<RefundRequest>) {
      const all = read<RefundRequest[]>(REFUNDS_FILE, []);
      const i = all.findIndex((r) => r.id === id);
      if (i < 0) return null;
      all[i] = { ...all[i], ...patch };
      write(REFUNDS_FILE, all);
      return all[i];
    },
  },
  meta: {
    all(): Record<string, PrinterOverride> { return read<Record<string, PrinterOverride>>(META_FILE, {}); },
    get(printerId: string): PrinterOverride {
      return read<Record<string, PrinterOverride>>(META_FILE, {})[printerId] ?? {};
    },
    set(printerId: string, patch: PrinterOverride) {
      const m = read<Record<string, PrinterOverride>>(META_FILE, {});
      m[printerId] = { ...(m[printerId] ?? {}), ...patch };
      write(META_FILE, m);
      return m[printerId];
    },
  },
  config: {
    get(): PricingConfig {
      const fallback: PricingConfig = {
        tiers: [
          { minSheets: 1, pricePerSheetCents: 150 },
          { minSheets: 6, pricePerSheetCents: 135 },
          { minSheets: 11, pricePerSheetCents: 125 },
        ],
        promo: { enabled: false, title: "", description: "" },
        coupons: [],
        site: DEFAULT_SITE,
      };
      try {
        const c = read<PricingConfig>(CONFIG_FILE, null as any);
        if (c && Array.isArray(c.tiers) && c.tiers.length) {
          return { ...fallback, ...c, site: { ...DEFAULT_SITE, ...(c.site ?? {}) } };
        }
      } catch {}
      return fallback;
    },
    set(c: PricingConfig) { write(CONFIG_FILE, c); return c; },
  },
  printers: {
    all(): Printer[] {
      const list = read<Printer[]>(PRINTERS_FILE, null as any);
      if (Array.isArray(list) && list.length) return list;
      write(PRINTERS_FILE, PRINTERS);
      return [...PRINTERS];
    },
    get(idOrSlug: string): Printer | undefined {
      return store.printers.all().find((p) => p.id === idOrSlug || p.slug === idOrSlug);
    },
    save(p: Printer) {
      const all = store.printers.all();
      const i = all.findIndex((x) => x.id === p.id);
      if (i >= 0) all[i] = p; else all.push(p);
      write(PRINTERS_FILE, all);
      return p;
    },
    remove(id: string): boolean {
      const all = store.printers.all();
      const next = all.filter((x) => x.id !== id);
      if (next.length === all.length) return false;
      write(PRINTERS_FILE, next);
      return true;
    },
  },
  couponsUsed: {
    // códigos de uso único já queimados (uppercase)
    all(): string[] { return read<string[]>(COUPONS_USED_FILE, []); },
    has(code: string): boolean {
      return read<string[]>(COUPONS_USED_FILE, []).includes(code.trim().toUpperCase());
    },
    burn(code: string) {
      const all = read<string[]>(COUPONS_USED_FILE, []);
      const c = code.trim().toUpperCase();
      if (!all.includes(c)) { all.push(c); write(COUPONS_USED_FILE, all); }
    },
  },
  paper: {
    get(printerId: string, fallback = 200): number {
      const m = read<PaperState>(PAPER_FILE, {});
      return m[printerId] ?? fallback;
    },
    set(printerId: string, qty: number) {
      const m = read<PaperState>(PAPER_FILE, {});
      m[printerId] = qty;
      write(PAPER_FILE, m);
    },
    consume(printerId: string, sheets: number, fallback = 200): number {
      const cur = store.paper.get(printerId, fallback);
      const next = Math.max(0, cur - sheets);
      store.paper.set(printerId, next);
      return next;
    },
  },
};

export function effectiveTiers(printerId: string, fallback: import("./printers").PriceTier[]): import("./printers").PriceTier[] {
  const metaTiers = store.meta.get(printerId).tiers;
  if (Array.isArray(metaTiers) && metaTiers.length) return metaTiers;
  const cfgTiers = store.config.get().tiers;
  return Array.isArray(cfgTiers) && cfgTiers.length ? cfgTiers : fallback;
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
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg }),
    });
    return { sent: true };
  } catch (e) {
    console.error(e);
    return { sent: false, reason: String(e) };
  }
}

// Lista canônica de impressoras (JSON, com overrides de status/papel aplicados).
export function listPrinters(): Printer[] {
  const meta = store.meta.all();
  return store.printers.all().map((p) => ({
    ...p,
    status: meta[p.id]?.status ?? p.status,
    paperCapacity: meta[p.id]?.paperCapacity ?? p.paperCapacity,
    paperAlertAt: meta[p.id]?.paperAlertAt ?? p.paperAlertAt,
    name: meta[p.id]?.name ?? p.name,
    location: meta[p.id]?.location ?? p.location,
    address: meta[p.id]?.address ?? p.address,
    code: meta[p.id]?.code ?? p.code,
    paperCurrent: store.paper.get(p.id, p.paperCurrent),
  }));
}

export function findPrinter(idOrSlug: string | null): Printer | undefined {
  if (!idOrSlug) return undefined;
  return listPrinters().find((p) => p.id === idOrSlug || p.slug === idOrSlug);
}

// Expira pedidos não pagos após 15min (chamado no início das rotas quentes).
export function sweepExpired(): number {
  const all = read<PrintJob[]>(JOBS_FILE, []);
  const now = Date.now();
  let n = 0;
  for (const j of all) {
    if (j.status === "awaiting_payment" && j.expiresAt && Date.parse(j.expiresAt) < now) {
      j.status = "expired";
      j.fileDataUrl = undefined;
      n++;
    }
  }
  if (n) write(JOBS_FILE, all);
  return n;
}

// Pausa a máquina quando o papel zera (vendas param + alerta).
export async function autoPauseIfEmpty(printerId: string, printerName: string, remaining: number) {
  if (remaining > 0) return false;
  const m = store.meta.get(printerId);
  if (m.status === "maintenance") return true;
  store.meta.set(printerId, { status: "maintenance" });
  await notifyPaused(printerName, "sem papel");
  return true;
}
