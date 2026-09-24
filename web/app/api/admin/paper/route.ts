import { NextResponse } from "next/server";
import { store, isAdmin, type PrinterOverride } from "@/lib/store";
import { PRINTERS } from "@/lib/printers";

// Gestão da impressora: POST { printerId, qty?, capacity?, alertAt?, status? }
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { printerId, qty, capacity, alertAt, status } = await req.json().catch(() => ({}));
  const printer = PRINTERS.find((p) => p.id === printerId || p.slug === printerId);
  if (!printer) return NextResponse.json({ error: "Impressora não encontrada" }, { status: 404 });

  if (qty !== undefined && qty !== "") store.paper.set(printer.id, Math.max(0, Number(qty)));

  const patch: PrinterOverride = {};
  if (capacity !== undefined && capacity !== "") patch.paperCapacity = Math.max(1, Number(capacity));
  if (alertAt !== undefined && alertAt !== "") patch.paperAlertAt = Math.max(0, Number(alertAt));
  if (["online", "offline", "maintenance"].includes(status)) patch.status = status;
  if (Object.keys(patch).length) store.meta.set(printer.id, patch);

  const o = store.meta.get(printer.id);
  return NextResponse.json({
    ok: true,
    printer: {
      ...printer,
      status: o.status ?? printer.status,
      paperCapacity: o.paperCapacity ?? printer.paperCapacity,
      paperAlertAt: o.paperAlertAt ?? printer.paperAlertAt,
      paperCurrent: store.paper.get(printer.id, printer.paperCurrent),
    },
  });
}
