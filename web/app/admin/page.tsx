"use client";
import { useCallback, useEffect, useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dt(iso: string) {
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

const STATUS_LABEL: Record<string, [string, string]> = {
  awaiting_payment: ["aguard. pagto", "bg-amber-50 text-amber-700 border-amber-200"],
  queued: ["na fila", "bg-brand-50 text-brand-700 border-brand-200"],
  printing: ["imprimindo", "bg-indigo-50 text-indigo-700 border-indigo-200"],
  done: ["concluído", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  failed: ["falhou", "bg-red-50 text-red-600 border-red-200"],
};

export default function Admin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loginPw, setLoginPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [msg, setMsg] = useState("");

  // form de edição da impressora
  const [fQty, setFQty] = useState("");
  const [fCap, setFCap] = useState("");
  const [fAlert, setFAlert] = useState("");
  const [fStatus, setFStatus] = useState("online");

  useEffect(() => {
    const k = sessionStorage.getItem("sp-admin");
    if (k) { setKey(k); setAuthed(true); }
  }, []);

  const load = useCallback(async (k: string) => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/stats", { headers: { "x-admin-key": k } });
      if (r.status === 401) { setAuthed(false); sessionStorage.removeItem("sp-admin"); return; }
      const d = await r.json();
      setData(d);
      if (!selectedId && d.printers?.length) {
        const p = d.printers[0];
        setSelectedId(p.id);
        setFQty(String(p.paperCurrent)); setFCap(String(p.paperCapacity));
        setFAlert(String(p.paperAlertAt)); setFStatus(p.status);
      }
    } finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { if (authed && key) load(key); }, [authed, key, load]);

  async function login() {
    setLoginErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: loginPw }) });
    if (!r.ok) { setLoginErr("Senha incorreta"); return; }
    sessionStorage.setItem("sp-admin", loginPw);
    setKey(loginPw); setLoginPw(""); setAuthed(true);
  }

  function select(p: any) {
    setSelectedId(p.id);
    setFQty(String(p.paperCurrent)); setFCap(String(p.paperCapacity));
    setFAlert(String(p.paperAlertAt)); setFStatus(p.status);
    setMsg("");
  }

  async function savePrinter() {
    setMsg("");
    const r = await fetch("/api/admin/paper", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ printerId: selectedId, qty: fQty, capacity: fCap, alertAt: fAlert, status: fStatus }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg("⚠️ " + (d.error ?? "Erro ao salvar")); return; }
    setMsg("✅ Impressora atualizada!");
    load(key);
  }

  async function setRefund(id: string, status: string) {
    await fetch("/api/refunds", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ id, status }),
    });
    load(key);
  }

  if (!authed) {
    return (
      <main className="min-h-screen font-sans bg-ink-900 flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-pop text-center">
          <div className="mx-auto size-12 rounded-2xl bg-gradient-to-br from-brand-500 to-ink-900 flex items-center justify-center text-white text-2xl">🔒</div>
          <h1 className="font-extrabold tracking-tight text-xl mt-4">Acesso restrito</h1>
          <p className="text-xs text-ink-400 font-medium mt-1">Painel do operador SafePrint</p>
          <input type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Senha" className="input mt-5 text-center" autoFocus />
          {loginErr && <p className="text-sm font-bold text-red-500 mt-2">{loginErr}</p>}
          <button onClick={login} className="btn-primary mt-3">Entrar</button>
        </div>
      </main>
    );
  }

  const kpis = data?.kpis;
  const printers: any[] = data?.printers ?? [];
  const sel = printers.find((p) => p.id === selectedId);
  const maxDay = Math.max(1, ...(data?.days ?? []).map((d: any) => d.revenue));
  const refunds: any[] = data?.refunds ?? [];

  return (
    <main className="min-h-screen font-sans bg-[#f6f7f9] p-5">
      <div className="max-w-5xl mx-auto space-y-5 pb-10">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-gradient-to-br from-brand-500 to-ink-900 flex items-center justify-center text-white shadow-pop">⎙</div>
            <div>
              <h1 className="font-extrabold tracking-tight text-lg leading-none">SafePrint • Operador</h1>
              <p className="text-xs text-ink-400 font-medium">BI + gestão das máquinas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => load(key)} className="text-xs font-bold border border-ink-200 bg-white rounded-xl px-3 py-2">↻ Atualizar</button>
            <button onClick={() => { sessionStorage.removeItem("sp-admin"); setAuthed(false); setData(null); }} className="text-xs font-bold border border-ink-200 bg-white rounded-xl px-3 py-2 text-red-500">Sair</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            ["💰 Faturamento total", kpis ? brl(kpis.revenue) : "…", "text-ink-900"],
            ["📈 Hoje", kpis ? brl(kpis.todayRevenue) : "…", "text-emerald-600"],
            ["🧻 Folhas impressas", kpis ? String(kpis.sheets) : "…", "text-ink-900"],
            ["📄 Páginas impressas", kpis ? String(kpis.pagesPrinted) : "…", "text-ink-900"],
            ["🧾 Pedidos pagos", kpis ? String(kpis.jobs) : "…", "text-ink-900"],
            ["⚠️ Reembolsos abertos", kpis ? String(kpis.refundsOpen) : "…", kpis?.refundsOpen ? "text-amber-600" : "text-ink-900"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="card p-4">
              <p className="text-[11px] font-bold text-ink-400">{l}</p>
              <p className={`font-display font-extrabold text-2xl tracking-tight ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* gráfico 7 dias */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="font-extrabold">Receita — últimos 7 dias</p>
            <p className="text-xs font-bold text-ink-400">total {kpis ? brl((data.days ?? []).reduce((s: number, d: any) => s + d.revenue, 0)) : ""}</p>
          </div>
          <div className="flex items-end gap-2 h-36 mt-4">
            {(data?.days ?? []).map((d: any) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] font-extrabold text-ink-500">{d.revenue ? brl(d.revenue).replace(",00", "") : ""}</span>
                <div className="w-full rounded-xl bg-gradient-to-t from-brand-600 to-brand-300 min-h-[6px] transition-all"
                  style={{ height: `${Math.max(4, (d.revenue / maxDay) * 100)}%`, opacity: d.revenue ? 1 : 0.25 }} />
                <span className="text-[10px] font-bold text-ink-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* impressoras */}
        <div>
          <p className="font-extrabold text-lg tracking-tight mb-2">🖨️ Impressoras</p>
          <div className="grid md:grid-cols-2 gap-3">
            {printers.map((p) => {
              const pct = Math.min(100, Math.round((p.paperCurrent / Math.max(1, p.paperCapacity)) * 100));
              const low = p.paperCurrent <= p.paperAlertAt;
              return (
                <button key={p.id} onClick={() => select(p)}
                  className={`card p-4 text-left transition ${selectedId === p.id ? "ring-4 ring-brand-500/20 border-brand-400" : "hover:border-brand-300"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold">{p.name}</p>
                      <p className="text-xs text-ink-400 font-medium">{p.location}</p>
                    </div>
                    <span className={`chip border ${p.status === "online" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : p.status === "maintenance" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                      {p.status === "online" ? "● online" : p.status === "maintenance" ? "● manutenção" : "● offline"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs font-bold">
                      <span className={low ? "text-red-500" : "text-ink-600"}>🧻 {p.paperCurrent}/{p.paperCapacity} folhas {low && "• RECARREGAR"}</span>
                      <span className="text-brand-600">{brl(p.revenue)} • {p.jobs} pedidos</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-ink-100 mt-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${low ? "bg-red-500" : pct < 50 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* detalhe da impressora */}
        {sel && (
          <div className="card p-5 md:p-6 space-y-5 border-brand-200">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-extrabold text-lg tracking-tight">{sel.name}</p>
                <p className="text-xs text-ink-400 font-medium break-all">QR da caixa: {typeof window !== "undefined" && `${window.location.origin}/imprimir?p=${sel.slug}`}</p>
              </div>
              <a className="text-xs font-bold text-brand-600 underline" target="_blank"
                href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(typeof window !== "undefined" ? `${window.location.origin}/imprimir?p=${sel.slug}` : sel.slug)}`}>baixar QR</a>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[["Receita", brl(sel.revenue)], ["Folhas", String(sel.sheets)], ["Pedidos", String(sel.jobs)]].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl bg-ink-50 border border-ink-100 py-3">
                  <p className="text-[11px] font-bold text-ink-400">{l}</p>
                  <p className="font-extrabold text-lg">{v}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4">
              <p className="font-extrabold text-sm mb-3">⚙️ Gerenciar máquina</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="text-xs font-bold text-ink-500">Papel atual
                  <input type="number" value={fQty} onChange={(e) => setFQty(e.target.value)} className="input mt-1" /></label>
                <label className="text-xs font-bold text-ink-500">Capacidade
                  <input type="number" value={fCap} onChange={(e) => setFCap(e.target.value)} className="input mt-1" /></label>
                <label className="text-xs font-bold text-ink-500">Alertar quando chegar em
                  <input type="number" value={fAlert} onChange={(e) => setFAlert(e.target.value)} className="input mt-1" /></label>
                <label className="text-xs font-bold text-ink-500">Status
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="input mt-1">
                    <option value="online">● Online</option>
                    <option value="maintenance">● Manutenção</option>
                    <option value="offline">● Offline</option>
                  </select></label>
              </div>
              <button onClick={savePrinter} className="mt-3 bg-ink-900 text-white text-sm font-bold px-5 py-2.5 rounded-2xl hover:bg-ink-800">Salvar alterações</button>
              {msg && <p className="text-sm font-bold mt-2">{msg}</p>}
              <p className="hint mt-2">Recarregou papel? Digite a quantidade colocada e salve. Offline/manutenção pausa as vendas na hora.</p>
            </div>

            <div>
              <p className="font-extrabold text-sm mb-2">🧾 Últimos pedidos</p>
              <div className="overflow-x-auto rounded-2xl border border-ink-100">
                <table className="w-full text-xs">
                  <thead><tr className="bg-ink-50 text-ink-400 text-left">
                    {[ "Data", "Arquivo", "Págs", "Cóp.", "Folhas", "Total", "Status"].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {(sel.recentJobs ?? []).map((j: any) => {
                      const [sl, sc] = STATUS_LABEL[j.status] ?? [j.status, "bg-ink-50 text-ink-500 border-ink-200"];
                      return (
                        <tr key={j.id} className="border-t border-ink-100">
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{dt(j.createdAt)}</td>
                          <td className="px-3 py-2 font-bold max-w-[140px] truncate">{j.fileName}</td>
                          <td className="px-3 py-2">{j.pages.length}</td>
                          <td className="px-3 py-2">{j.copies}</td>
                          <td className="px-3 py-2 font-bold">{j.sheets}</td>
                          <td className="px-3 py-2 font-bold">{brl(j.totalCents)}</td>
                          <td className="px-3 py-2"><span className={`chip border ${sc}`}>{sl}</span></td>
                        </tr>
                      );
                    })}
                    {!(sel.recentJobs ?? []).length && <tr><td colSpan={7} className="px-3 py-4 text-center text-ink-300 font-medium">Nenhum pedido ainda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* reembolsos */}
        <div className="card p-5">
          <p className="font-extrabold text-lg tracking-tight mb-3">💸 Reembolsos ({refunds.filter((r: any) => r.status === "open").length} abertos)</p>
          <div className="grid gap-3">
            {refunds.map((r: any) => (
              <div key={r.id} className="rounded-2xl bg-ink-50 border border-ink-100 p-4 text-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-extrabold">{r.motiveLabel ?? (r as any).reason ?? "Reembolso"}</p>
                  <span className={`chip border ${r.status === "open" ? "bg-amber-50 text-amber-700 border-amber-200" : r.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                    {r.status === "open" ? "aguardando análise" : r.status === "approved" ? "aprovado" : "recusado"}
                  </span>
                </div>
                <p className="text-xs text-ink-400 font-medium">{r.printerName} • Pedido {String(r.jobId).slice(0, 8)} • {dt(r.createdAt)}</p>
                {r.description && <p className="text-ink-700 font-medium">“{r.description}”</p>}
                {(r.name || r.whatsapp) && (
                  <p className="font-bold">{r.name}
                    {r.whatsapp && <> • <a className="text-emerald-600 underline" target="_blank" href={`https://wa.me/55${r.whatsapp}`}>📲 {r.whatsapp}</a></>}
                  </p>
                )}
                <div className="flex gap-3 items-start">
                  {r.photoDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photoDataUrl} alt="defeito" className="rounded-2xl max-h-44 border border-ink-200" />
                  )}
                </div>
                {r.status === "open" && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setRefund(r.id, "approved")} className="text-xs font-extrabold bg-emerald-500 text-white rounded-xl px-4 py-2">✓ Aprovar (reembolsar Pix)</button>
                    <button onClick={() => setRefund(r.id, "rejected")} className="text-xs font-extrabold border border-red-300 text-red-500 rounded-xl px-4 py-2">✕ Recusar</button>
                  </div>
                )}
              </div>
            ))}
            {!refunds.length && <p className="text-xs text-ink-400 font-medium">Nenhum pedido de estorno.</p>}
          </div>
        </div>

        {loading && <p className="text-center text-xs font-bold text-ink-300">Carregando…</p>}
      </div>
    </main>
  );
}
