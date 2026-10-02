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
  const [fName, setFName] = useState("");
  const [fLoc, setFLoc] = useState("");
  const [fAddr, setFAddr] = useState("");

  // preços e promoções
  const [tiers, setTiers] = useState<{ minSheets: string; price: string }[]>([]);
  const [promoOn, setPromoOn] = useState(false);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDesc, setPromoDesc] = useState("");
  const [priceMsg, setPriceMsg] = useState("");
  const [coupons, setCoupons] = useState<{ code: string; percentOff: string; active: boolean }[]>([]);
  const [newCoupon, setNewCoupon] = useState("");
  const [newCouponPct, setNewCouponPct] = useState("");

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
      if (d.config) {
        setTiers((d.config.tiers ?? []).map((t: any) => ({ minSheets: String(t.minSheets), price: (t.pricePerSheetCents / 100).toFixed(2).replace(".", ",") })));
        setPromoOn(Boolean(d.config.promo?.enabled));
        setPromoTitle(d.config.promo?.title ?? "");
        setPromoDesc(d.config.promo?.description ?? "");
        setCoupons((d.config.coupons ?? []).map((c: any) => ({ code: c.code, percentOff: String(c.percentOff), active: c.active !== false })));
      }
      if (!selectedId && d.printers?.length) {
        const p = d.printers[0];
        setSelectedId(p.id);
        setFQty(String(p.paperCurrent)); setFCap(String(p.paperCapacity));
        setFAlert(String(p.paperAlertAt)); setFStatus(p.status);
        setFName(p.name ?? ""); setFLoc(p.location ?? ""); setFAddr(p.address ?? "");
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
    setFName(p.name ?? ""); setFLoc(p.location ?? ""); setFAddr(p.address ?? "");
    setMsg("");
  }

  async function savePrinter() {
    setMsg("");
    const r = await fetch("/api/admin/paper", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ printerId: selectedId, qty: fQty, capacity: fCap, alertAt: fAlert, status: fStatus, name: fName, location: fLoc, address: fAddr }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg("⚠️ " + (d.error ?? "Erro ao salvar")); return; }
    setMsg("✅ Impressora atualizada!");
    load(key);
  }

  async function savePricing() {
    setPriceMsg("");
    const parsed = tiers.map((t) => ({
      minSheets: Number(t.minSheets),
      pricePerSheetCents: Math.round(Number(t.price.replace(",", ".")) * 100),
    }));
    const r = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ tiers: parsed, promo: { enabled: promoOn, title: promoTitle, description: promoDesc }, coupons: coupons.map((c) => ({ code: c.code, percentOff: Number(c.percentOff), active: c.active })) }),
    });
    const d = await r.json();
    if (!r.ok) { setPriceMsg("⚠️ " + (d.error ?? "Erro ao salvar")); return; }
    setPriceMsg("✅ Preços e promoção atualizados! Já estão valendo no site.");
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

            {/* saúde da máquina */}
            {(() => {
              const life = Number(sel.lifetimeSheets ?? 0);
              const DRUM = 30000;
              const drumPct = Math.max(0, Math.min(100, 100 - (life / DRUM) * 100));
              return (
                <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4">
                  <p className="font-extrabold text-sm mb-3">🩺 Saúde do consumível</p>
                  <div className="flex justify-between text-xs font-bold">
                    <span className={drumPct < 20 ? "text-red-500" : "text-ink-600"}>Unidade de cilindro estimada {drumPct.toFixed(0)}%</span>
                    <span className="text-ink-400">{life.toLocaleString("pt-BR")} / {DRUM.toLocaleString("pt-BR")} folhas</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-ink-100 mt-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${drumPct < 20 ? "bg-red-500" : drumPct < 50 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${drumPct}%` }} />
                  </div>
                  <p className="hint mt-2">Estimativa por folhas impressas no ciclo. Zere recarregando o contador no papel da máquina... e anote a troca real do consumível.</p>
                </div>
              );
            })()}

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

            <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4">
              <p className="font-extrabold text-sm mb-3">📍 Unidade / local da máquina</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                <label className="text-xs font-bold text-ink-500">Nome da unidade
                  <input value={fName} onChange={(e) => setFName(e.target.value)} className="input mt-1" placeholder="UniFACEF — Bloco A" /></label>
                <label className="text-xs font-bold text-ink-500">Local / sala
                  <input value={fLoc} onChange={(e) => setFLoc(e.target.value)} className="input mt-1" placeholder="Bloco A, térreo, cantina" /></label>
                <label className="text-xs font-bold text-ink-500">Endereço
                  <input value={fAddr} onChange={(e) => setFAddr(e.target.value)} className="input mt-1" placeholder="Av. ..., 2400 - Franca/SP" /></label>
              </div>
              <p className="hint mt-2">As mudanças refletem no site para os estudantes na hora (use &quot;Salvar alterações&quot; acima também).</p>
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

        {/* preços & promoções */}
        <div className="card p-5 md:p-6 space-y-5">
          <div>
            <p className="font-extrabold text-lg tracking-tight">🏷️ Preços & promoções</p>
            <p className="text-xs text-ink-400 font-medium mt-0.5">Vale para todas as máquinas. A faixa de menor &quot;a partir de&quot; define o preço base.</p>
          </div>

          <div className="space-y-2.5">
            <p className="label">Faixas de preço (por folha)</p>
            {tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-400 w-24 shrink-0">{i === 0 ? "a partir de" : "de"}</span>
                <input type="number" min={1} disabled={i === 0} value={t.minSheets}
                  onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, minSheets: e.target.value } : x))}
                  className="input !py-2.5 w-24 disabled:bg-ink-50 disabled:text-ink-300" placeholder="mín. folhas" />
                <span className="text-xs font-bold text-ink-400">folhas →</span>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-sm font-bold text-ink-500">R$</span>
                  <input value={t.price} inputMode="decimal"
                    onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                    className="input !py-2.5" placeholder="1,50" />
                </div>
                {tiers.length > 1 && i > 0 && (
                  <button onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="text-xs font-bold text-red-400 px-2">✕</button>
                )}
              </div>
            ))}
            <button onClick={() => setTiers([...tiers, { minSheets: "", price: "" }])} className="text-xs font-extrabold text-brand-600">+ adicionar faixa</button>
          </div>

          <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={promoOn} onChange={(e) => setPromoOn(e.target.checked)} className="size-4 accent-ink-900" />
              <span className="text-sm font-extrabold">Ativar banner de promoção no site</span>
            </label>
            <input value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="input" placeholder="Título da promoção (ex: Semana do TCC)" disabled={!promoOn} />
            <input value={promoDesc} onChange={(e) => setPromoDesc(e.target.value)} className="input" placeholder="Descrição (ex: De 6 a 10 folhas por R$ 1,25 até sexta)" disabled={!promoOn} />
          </div>

          <div className="space-y-2.5">
            <p className="label">🎟️ Cupons de desconto</p>
            {coupons.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={c.code} onChange={(e) => setCoupons(coupons.map((x, j) => j === i ? { ...x, code: e.target.value } : x))} className="input !py-2.5 flex-1 uppercase font-mono" placeholder="ALUNO10" />
                <input value={c.percentOff} inputMode="numeric" onChange={(e) => setCoupons(coupons.map((x, j) => j === i ? { ...x, percentOff: e.target.value } : x))} className="input !py-2.5 w-24" placeholder="10" />
                <span className="text-xs font-bold text-ink-400">% off</span>
                <label className="flex items-center gap-1 text-xs font-bold text-ink-500">
                  <input type="checkbox" checked={c.active} onChange={(e) => setCoupons(coupons.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} className="size-4 accent-ink-900" /> ativo
                </label>
                <button onClick={() => setCoupons(coupons.filter((_, j) => j !== i))} className="text-xs font-bold text-red-400 px-2">✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={newCoupon} onChange={(e) => setNewCoupon(e.target.value)} className="input !py-2.5 flex-1 uppercase font-mono" placeholder="NOVO CUPOM" />
              <input value={newCouponPct} inputMode="numeric" onChange={(e) => setNewCouponPct(e.target.value)} className="input !py-2.5 w-24" placeholder="%" />
              <button onClick={() => { if (newCoupon.trim() && newCouponPct) { setCoupons([...coupons, { code: newCoupon, percentOff: newCouponPct, active: true }]); setNewCoupon(""); setNewCouponPct(""); } }} className="text-xs font-extrabold text-brand-600">+ adicionar</button>
            </div>
            <p className="hint">O estudante digita o código na etapa de ajustes e o desconto entra no total.</p>
          </div>

          <button onClick={savePricing} className="bg-ink-900 text-white text-sm font-bold px-5 py-2.5 rounded-2xl hover:bg-ink-800">Salvar preços e promoção</button>
          {priceMsg && <p className="text-sm font-bold">{priceMsg}</p>}
        </div>

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
