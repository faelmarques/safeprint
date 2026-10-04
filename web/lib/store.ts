// Store em memória + JSON para MVP.
// Trocar por Postgres/Prisma em produção sem mudar a API das rotas.
import fs from "fs";
import path from "path";

export type JobStatus = "awaiting_payment" | "queued" | "printing" | "done" | "failed";
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
  fileDataUrl?: string; // MVP: base64 pequeno. Produção: URL S3 privada com expiração.
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
}

export interface PricingConfig {
  tiers: import("./printers").PriceTier[];
  promo: { enabled: boolean; title: string; description: string };
  coupons: Coupon[];
}

export function isAdmin(req: Request): boolean {
  const key = req.headers.get("x-admin-key") ?? "";
  return key !== "" && key === (process.env.ADMIN_PASSWORD || "admin");
}

const DATA_DIR = path.join(process.cwd(), "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const REFUNDS_FILE = path.join(DATA_DIR, "refunds.json");
const PAPER_FILE = path.join(DATA_DIR, "paper.json");
const META_FILE = path.join(DATA_DIR, "printers-meta.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

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
  }, null, 2));
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
  fs.writeFileSync(f, JSON.stringify(v, null, 2));
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
      return read<PrintJob[]>(JOBS_FILE, []).filter((j) => j.printerId === printerId && j.status === "queued");
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
      try {
        const c = read<PricingConfig>(CONFIG_FILE, null as any);
        if (c && Array.isArray(c.tiers) && c.tiers.length) return c;
      } catch {}
      return { tiers: [
        { minSheets: 1, pricePerSheetCents: 150 },
        { minSheets: 6, pricePerSheetCents: 135 },
        { minSheets: 11, pricePerSheetCents: 125 },
      ], promo: { enabled: false, title: "", description: "" }, coupons: [] };
    },
    set(c: PricingConfig) { write(CONFIG_FILE, c); return c; },
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
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const msg = `🧻 SafePrint: papel baixo em "${printerName}" — restam ${remaining} folhas. Recarregue!`;
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
