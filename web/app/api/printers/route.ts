import { NextResponse } from "next/server";
import { store, effectiveTiers, listPrinters } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await store.config.get();
  const burned = new Set(await store.couponsUsed.all());
  const printers = await Promise.all(
    (await listPrinters()).map(async (p) => ({
      ...p,
      tiers: await effectiveTiers(p.id, p.tiers),
    }))
  );
  return NextResponse.json({ printers, site: cfg.site, promo: cfg.promo, coupons: (cfg.coupons ?? []).filter((c) => c.active && !(c.singleUse && burned.has(c.code.toUpperCase()))).map((c) => ({ code: c.code, percentOff: c.percentOff, singleUse: !!c.singleUse })) });
}
