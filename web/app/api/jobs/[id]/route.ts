import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const job = store.jobs.get(params.id);
  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ job });
}

// Cancela enquanto não saiu da fila (awaiting_payment ou queued)
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const job = store.jobs.get(params.id);
  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (job.status === "printing" || job.status === "done") {
    return NextResponse.json({ error: "Já está imprimindo, não dá mais para cancelar" }, { status: 409 });
  }
  job.status = "failed";
  job.fileDataUrl = undefined;
  store.jobs.save(job);
  return NextResponse.json({ ok: true });
}
