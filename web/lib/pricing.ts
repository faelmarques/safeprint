import type { PriceTier } from "./printers";

export function pricePerSheet(sheets: number, tiers: PriceTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.minSheets - a.minSheets);
  for (const t of sorted) {
    if (sheets >= t.minSheets) return t.pricePerSheetCents;
  }
  return sorted[sorted.length - 1].pricePerSheetCents;
}

export function calcSheets(pagesCount: number, copies: number, duplex: boolean): number {
  const total = pagesCount * copies;
  return duplex ? Math.ceil(total / 2) : total;
}

export function calcTotal(sheets: number, tiers: PriceTier[]) {
  const unit = pricePerSheet(sheets, tiers);
  return { sheets, unitCents: unit, totalCents: sheets * unit };
}

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "1-3,5,8-10" -> [1,2,3,5,8,9,10] limitado ao total */
export function parsePageRange(input: string, totalPages: number): number[] {
  if (!input.trim().toLowerCase().startsWith("todas") && input.trim() === "") return [];
  if (input.trim().toLowerCase() === "todas" || input.trim() === "") {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out = new Set<number>();
  for (const part of input.split(",")) {
    const p = part.trim();
    if (p.includes("-")) {
      const [a, b] = p.split("-").map(Number);
      if (!a || !b) continue;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
        if (i >= 1 && i <= totalPages) out.add(i);
      }
    } else {
      const n = Number(p);
      if (n >= 1 && n <= totalPages) out.add(n);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}
