import { NextResponse } from "next/server";
import { PRINTERS } from "@/lib/printers";
import { store, isAdmin } from "@/lib/store";

const PAID = ["queued", "printing", "done"];

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const meta = store.meta.all();
  const jobs = store.jobs.all();
  const refunds = store.refunds.all();
  const paid = jobs.filter((j) => PAID.includes(j.status));

  const revenue = paid.reduce((s, j) => s + j.totalCents, 0);
  const sheets = paid.reduce((s, j) => s + j.sheets, 0);
  const pagesPrinted = paid.reduce((s, j) => s + j.pages.length * j.copies, 0);

  const today = new Date().toISOString().slice(0, 10);
  const todayRevenue = paid.filter((j) => j.createdAt.slice(0, 10) === today).reduce((s, j) => s + j.totalCents, 0);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const dj = paid.filter((j) => j.createdAt.slice(0, 10) === key);
    return {
      date: key,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      revenue: dj.reduce((s, j) => s + j.totalCents, 0),
      jobs: dj.length,
    };
  });

  const printers = PRINTERS.map((p) => {
    const pj = paid.filter((j) => j.printerId === p.id);
    return {
      ...p,
      status: meta[p.id]?.status ?? p.status,
      paperCapacity: meta[p.id]?.paperCapacity ?? p.paperCapacity,
      paperAlertAt: meta[p.id]?.paperAlertAt ?? p.paperAlertAt,
      paperCurrent: store.paper.get(p.id, p.paperCurrent),
      revenue: pj.reduce((s, j) => s + j.totalCents, 0),
      sheets: pj.reduce((s, j) => s + j.sheets, 0),
      pagesPrinted: pj.reduce((s, j) => s + j.pages.length * j.copies, 0),
      jobs: pj.length,
      refundsOpen: refunds.filter(
        (r) => r.status === "open" && jobs.find((j) => j.id === r.jobId)?.printerId === p.id
      ).length,
      recentJobs: jobs.filter((j) => j.printerId === p.id).slice(0, 15),
    };
  });

  // nome da impressora em cada reembolso (pro painel)
  const refundsWithPrinter = refunds.map((r) => ({
    ...r,
    printerName: PRINTERS.find((p) => p.id === jobs.find((j) => j.id === r.jobId)?.printerId)?.name ?? "—",
  }));

  return NextResponse.json({
    kpis: {
      revenue,
      todayRevenue,
      sheets,
      pagesPrinted,
      jobs: paid.length,
      refundsOpen: refunds.filter((r) => r.status === "open").length,
      paperTotal: printers.reduce((s, p) => s + p.paperCurrent, 0),
    },
    days,
    printers,
    refunds: refundsWithPrinter,
  });
}
