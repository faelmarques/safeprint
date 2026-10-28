import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { store, isAdmin } from "@/lib/store";
import { DEFAULT_TIERS, type Printer } from "@/lib/printers";
import { rateLimit } from "@/lib/ratelimit";

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "unidade"
  );
}

function newSlug(name: string): string {
  return `${slugify(name)}-${randomBytes(24).toString("hex")}`;
}

function newCode(existing: Printer[]): string {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    if (!existing.some((p) => p.code === c)) return c;
  }
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

export async function GET(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const printers = await store.printers.all();
  return NextResponse.json({ printers });
}

export async function POST(req: Request) {
  const rl = rateLimit(req, "admin-printers", 30, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Nome da unidade obrigatório" }, { status: 400 });

  const existing = await store.printers.all();
  let code = String(body.code ?? "").replace(/\D/g, "").slice(0, 6);
  if (code && !/^\d{6}$/.test(code)) return NextResponse.json({ error: "Código deve ter 6 dígitos" }, { status: 400 });
  if (code && existing.some((p) => p.code === code)) {
    return NextResponse.json({ error: "Código já usado em outra máquina" }, { status: 409 });
  }
  if (!code) code = newCode(existing);

  const p: Printer = {
    id: `printer-${Date.now().toString(36)}`,
    slug: newSlug(name),
    code,
    name,
    location: String(body.location ?? "").trim().slice(0, 120),
    address: String(body.address ?? "").trim().slice(0, 120),
    status: "online",
    paperCurrent: 0,
    paperCapacity: Math.max(1, Number(body.paperCapacity ?? 250) || 250),
    paperAlertAt: Math.max(0, Number(body.paperAlertAt ?? 50) || 0),
    tiers: DEFAULT_TIERS,
    colorAvailable: false,
  };
  await store.printers.save(p);
  await store.paper.set(p.id, Number(body.paperCurrent ?? 0) || 0);
  return NextResponse.json({ ok: true, printer: p });
}

export async function PUT(req: Request) {
  const rl = rateLimit(req, "admin-printers", 30, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const p = await store.printers.get(String(body.id ?? ""));
  if (!p) return NextResponse.json({ error: "Impressora não encontrada" }, { status: 404 });

  if (body.code !== undefined && body.code !== "") {
    const code = String(body.code).replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Código deve ter 6 dígitos" }, { status: 400 });
    const all = await store.printers.all();
    if (all.some((x) => x.id !== p.id && x.code === code)) {
      return NextResponse.json({ error: "Código já usado em outra máquina" }, { status: 409 });
    }
    p.code = code;
  }
  if (typeof body.name === "string" && body.name.trim()) p.name = body.name.trim().slice(0, 80);
  if (typeof body.location === "string") p.location = body.location.trim().slice(0, 120);
  if (typeof body.address === "string") p.address = body.address.trim().slice(0, 120);
  if (["online", "offline", "maintenance"].includes(body.status)) p.status = body.status;
  if (body.paperCapacity !== undefined && body.paperCapacity !== "") {
    p.paperCapacity = Math.max(1, Number(body.paperCapacity) || p.paperCapacity);
  }
  if (body.paperAlertAt !== undefined && body.paperAlertAt !== "") {
    p.paperAlertAt = Math.max(0, Number(body.paperAlertAt) || 0);
  }
  if (body.regenSlug) {
    p.slug = newSlug(p.name);
    p.code = newCode((await store.printers.all()).filter((x) => x.id !== p.id));
  }
  await store.printers.save(p);
  return NextResponse.json({ ok: true, printer: p });
}

export async function DELETE(req: Request) {
  const rl = rateLimit(req, "admin-printers", 30, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  const p = await store.printers.get(String(id ?? ""));
  if (!p) return NextResponse.json({ error: "Impressora não encontrada" }, { status: 404 });
  const all = await store.jobs.all();
  const active = all.filter((j) => j.printerId === p.id && ["queued", "printing"].includes(j.status));
  if (active.length) {
    return NextResponse.json({ error: `Há ${active.length} pedido(s) na fila. Aguarde esvaziar ou cancele antes.` }, { status: 409 });
  }
  await store.printers.remove(p.id);
  return NextResponse.json({ ok: true });
}
