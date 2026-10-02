import { NextResponse } from "next/server";
import { store, isAdmin } from "@/lib/store";

// GET devolve a config atual; POST salva { tiers: [{minSheets, pricePerSheetCents}], promo: {enabled,title,description} }
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ config: store.config.get() });
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { tiers, promo, coupons } = await req.json().catch(() => ({}));

  let cleanTiers: { minSheets: number; pricePerSheetCents: number }[] | undefined;
  if (Array.isArray(tiers)) {
    cleanTiers = tiers
      .map((t: any) => ({ minSheets: Math.max(1, Math.floor(Number(t.minSheets))), pricePerSheetCents: Math.max(1, Math.round(Number(t.pricePerSheetCents))) }))
      .filter((t: any) => Number.isFinite(t.minSheets) && Number.isFinite(t.pricePerSheetCents))
      .sort((a: any, b: any) => a.minSheets - b.minSheets);
    if (!cleanTiers.length || cleanTiers[0].minSheets !== 1) {
      return NextResponse.json({ error: "Precisa de ao menos uma faixa começando em 1 folha" }, { status: 400 });
    }
  }

  const cur = store.config.get();
  let cleanCoupons: { code: string; percentOff: number; active: boolean }[] | undefined;
  if (Array.isArray(coupons)) {
    cleanCoupons = coupons
      .map((c: any) => ({ code: String(c.code ?? "").trim().toUpperCase().slice(0, 20), percentOff: Math.min(100, Math.max(1, Math.round(Number(c.percentOff)))), active: c.active !== false }))
      .filter((c: any) => c.code.length >= 2 && Number.isFinite(c.percentOff));
  }
  const next = store.config.set({
    tiers: cleanTiers ?? cur.tiers,
    promo: promo && typeof promo === "object"
      ? {
          enabled: Boolean(promo.enabled),
          title: String(promo.title ?? "").slice(0, 80),
          description: String(promo.description ?? "").slice(0, 160),
        }
      : cur.promo,
    coupons: cleanCoupons ?? cur.coupons ?? [],
  });
  return NextResponse.json({ ok: true, config: next });
}
