import { NextResponse } from "next/server";
import { PRINTERS } from "@/lib/printers";
import { store, effectiveTiers } from "@/lib/store";

export async function GET() {
  const meta = store.meta.all();
  const printers = PRINTERS.map((p) => ({
    ...p,
    status: meta[p.id]?.status ?? p.status,
    paperCapacity: meta[p.id]?.paperCapacity ?? p.paperCapacity,
    paperAlertAt: meta[p.id]?.paperAlertAt ?? p.paperAlertAt,
    name: meta[p.id]?.name ?? p.name,
    location: meta[p.id]?.location ?? p.location,
    address: meta[p.id]?.address ?? p.address,
    paperCurrent: store.paper.get(p.id, p.paperCurrent),
    tiers: effectiveTiers(p.id, p.tiers),
  }));
  return NextResponse.json({ printers, promo: store.config.get().promo, coupons: (store.config.get().coupons ?? []).filter((c) => c.active).map((c) => ({ code: c.code, percentOff: c.percentOff })) });
}
