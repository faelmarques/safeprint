import { NextResponse } from "next/server";
import { PRINTERS } from "@/lib/printers";
import { store } from "@/lib/store";

export async function GET() {
  const meta = store.meta.all();
  const printers = PRINTERS.map((p) => ({
    ...p,
    status: meta[p.id]?.status ?? p.status,
    paperCapacity: meta[p.id]?.paperCapacity ?? p.paperCapacity,
    paperAlertAt: meta[p.id]?.paperAlertAt ?? p.paperAlertAt,
    paperCurrent: store.paper.get(p.id, p.paperCurrent),
  }));
  return NextResponse.json({ printers });
}
