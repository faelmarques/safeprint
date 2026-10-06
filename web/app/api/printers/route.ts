import { NextResponse } from "next/server";
import { store, effectiveTiers, listPrinters } from "@/lib/store";

export async function GET() {
  const cfg = store.config.get();
  const burned = new Set(store.couponsUsed.all());
  const printers = listPrinters().map((p) => ({
    ...p,
    tiers: effectiveTiers(p.id, p.tiers),
  }));
  return NextResponse.json({ printers, site: cfg.site, promo: cfg.promo, coupons: (cfg.coupons ?? []).filter((c) => c.active && !(c.singleUse && burned.has(c.code.toUpperCase()))).map((c) => ({ code: c.code, percentOff: c.percentOff, singleUse: !!c.singleUse })) });
}
