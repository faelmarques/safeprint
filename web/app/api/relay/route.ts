import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Relay do notebook-vigia (armário) → grupo WhatsApp (Evolution na mesma VPS).
// POST { secret, action: "hb" | "text", text?, metrics? }
//  - hb: registra heartbeat (o cron da VPS detecta offline/online)
//  - text: encaminha mensagem pro grupo

function readMonitorConfig(): Record<string, string> {
  const cfg: Record<string, string> = {};
  try {
    const p = path.join(process.cwd(), "..", "monitor", "config.env");
    for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
      const l = line.trim();
      if (l && !l.startsWith("#") && l.includes("=")) {
        const [k, ...v] = l.split("=");
        cfg[k.trim()] = v.join("=");
      }
    }
  } catch {}
  return cfg;
}

async function sendToGroup(text: string) {
  const cfg = readMonitorConfig();
  const url = cfg.EVOLUTION_URL || "http://localhost:8081";
  const key = cfg.EVOLUTION_API_KEY || "";
  const instance = cfg.INSTANCE || "safeprint";
  const group = cfg.GROUP_ID || "";
  if (!group) { console.log("[relay sem grupo]", text); return { sent: false, reason: "GROUP_ID vazio" }; }
  try {
    const r = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ number: group, text }),
      signal: AbortSignal.timeout(15000),
    });
    return { sent: r.ok };
  } catch (e) {
    console.error("relay erro:", e);
    return { sent: false };
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const secret = process.env.RELAY_SECRET || "safeprint-dev-relay";
  if (body.secret !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const HB = path.join(process.cwd(), "data", "net-heartbeat.json");

  if (body.action === "hb") {
    const prev = (() => { try { return JSON.parse(fs.readFileSync(HB, "utf-8")); } catch { return {}; } })();
    fs.writeFileSync(HB, JSON.stringify({
      ts: Date.now(),
      metrics: body.metrics ?? prev.metrics ?? null,
      offlineSince: prev.offlineSince ?? null,
    }));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "text" && typeof body.text === "string" && body.text.length <= 2000) {
    const res = await sendToGroup(body.text.slice(0, 2000));
    return NextResponse.json(res, { status: res.sent ? 200 : 502 });
  }

  return NextResponse.json({ error: "ação inválida" }, { status: 400 });
}
