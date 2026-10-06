"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  expired: ["expirado", "bg-ink-50 text-ink-400 border-ink-200"],
};

type Tab = "dash" | "pedidos" | "locais" | "precos" | "financeiro" | "reembolsos" | "site" | "seg";

const TABS: [Tab, string, string][] = [
  ["dash", "📊", "Visão geral"],
  ["pedidos", "🧾", "Pedidos"],
  ["locais", "📍", "Locais"],
  ["precos", "🏷️", "Preços e cupons"],
  ["financeiro", "💰", "Financeiro"],
  ["reembolsos", "💸", "Reembolsos"],
  ["site", "🎨", "Site"],
  ["seg", "🔐", "Segurança"],
];

export default function Admin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loginPw, setLoginPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginTotp, setLoginTotp] = useState("");
  const [loginMfa, setLoginMfa] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("dash");
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
  const [fCode, setFCode] = useState("");

  // novo local
  const [showNew, setShowNew] = useState(false);
  const [nName, setNName] = useState("");
  const [nLoc, setNLoc] = useState("");
  const [nAddr, setNAddr] = useState("");
  const [nCode, setNCode] = useState("");
  const [nCap, setNCap] = useState("250");
  const [nQty, setNQty] = useState("0");

  // preços e promoções
  const [tiers, setTiers] = useState<{ minSheets: string; price: string }[]>([]);
  const [promoOn, setPromoOn] = useState(false);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDesc, setPromoDesc] = useState("");
  const [priceMsg, setPriceMsg] = useState("");
  const [coupons, setCoupons] = useState<{ code: string; percentOff: string; active: boolean; singleUse?: boolean }[]>([]);
  const [newCoupon, setNewCoupon] = useState("");
  const [newCouponPct, setNewCouponPct] = useState("");
  const [fin, setFin] = useState<any>(null);
  const [finMsg, setFinMsg] = useState("");

  // segurança
  const [sec, setSec] = useState<any>(null);
  const [secMsg, setSecMsg] = useState("");
  const [pwCur, setPwCur] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaUrl, setMfaUrl] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  // site (textos)
  const [sName, setSName] = useState("");
  const [sTag, setSTag] = useState("");
  const [sBadge, setSBadge] = useState("");
  const [sTitle, setSTitle] = useState("");
  const [sSub, setSSub] = useState("");
  const [sFoot, setSFoot] = useState("");
  const [siteMsg, setSiteMsg] = useState("");

  // pedidos
  const [orderFilter, setOrderFilter] = useState("all");

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
        setCoupons((d.config.coupons ?? []).map((c: any) => ({ code: c.code, percentOff: String(c.percentOff), active: c.active !== false, singleUse: c.singleUse === true })));
        const s = d.config.site ?? {};
        setSName(s.siteName ?? ""); setSTag(s.tagline ?? ""); setSBadge(s.heroBadge ?? "");
        setSTitle(s.heroTitle ?? ""); setSSub(s.heroSub ?? ""); setSFoot(s.footerNote ?? "");
      }
      if (!selectedId && d.printers?.length) {
        const p = d.printers[0];
        setSelectedId(p.id);
        setFQty(String(p.paperCurrent)); setFCap(String(p.paperCapacity));
        setFAlert(String(p.paperAlertAt)); setFStatus(p.status);
        setFName(p.name ?? ""); setFLoc(p.location ?? ""); setFAddr(p.address ?? ""); setFCode(p.code ?? "");
      }
    } finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { if (authed && key) load(key); }, [authed, key, load]);
  useEffect(() => { if (authed && key && tab === "seg") loadSec(); }, [tab, authed, key]);

  async function login() {
    setLoginErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: loginPw, totp: loginTotp || undefined }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (d.mfaRequired) setLoginMfa(true);
      setLoginErr(d.error ?? "Senha incorreta");
      return;
    }
    sessionStorage.setItem("sp-admin", d.token);
    setKey(d.token); setLoginPw(""); setLoginTotp(""); setLoginMfa(false); setAuthed(true);
  }

  function select(p: any) {
    setSelectedId(p.id);
    setFQty(String(p.paperCurrent)); setFCap(String(p.paperCapacity));
    setFAlert(String(p.paperAlertAt)); setFStatus(p.status);
    setFName(p.name ?? ""); setFLoc(p.location ?? ""); setFAddr(p.address ?? ""); setFCode(p.code ?? "");
    setMsg("");
  }

  async function savePrinter() {
    setMsg("");
    const r = await fetch("/api/admin/paper", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ printerId: selectedId, qty: fQty, capacity: fCap, alertAt: fAlert, status: fStatus, name: fName, location: fLoc, address: fAddr, code: fCode }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg("⚠️ " + (d.error ?? "Erro ao salvar")); return; }
    setMsg("✅ Impressora atualizada!");
    load(key);
  }

  async function createPrinter() {
    setMsg("");
    const r = await fetch("/api/admin/printers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ name: nName, location: nLoc, address: nAddr, code: nCode, paperCapacity: nCap, paperCurrent: nQty }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg("⚠️ " + (d.error ?? "Erro ao criar")); return; }
    setMsg(`✅ Local criado! Código ${d.printer.code} — imprima o QR abaixo e cole na caixa.`);
    setShowNew(false); setNName(""); setNLoc(""); setNAddr(""); setNCode("");
    setSelectedId(d.printer.id);
    select({ ...d.printer, paperCurrent: nQty || 0 });
    load(key);
  }

  async function deletePrinter() {
    const p = (data?.printers ?? []).find((x: any) => x.id === selectedId);
    if (!p) return;
    if (!confirm(`Excluir "${p.name}"? O QR dela para de funcionar.`)) return;
    setMsg("");
    const r = await fetch("/api/admin/printers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ id: selectedId }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg("⚠️ " + (d.error ?? "Erro ao excluir")); return; }
    setMsg("✅ Local excluído.");
    setSelectedId("");
    load(key);
  }

  async function regenQr() {
    if (!confirm("Gerar novo QR + código? O adesivo antigo para de funcionar.")) return;
    setMsg("");
    const r = await fetch("/api/admin/printers", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ id: selectedId, regenSlug: true }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg("⚠️ " + (d.error ?? "Erro")); return; }
    setMsg(`✅ Novo QR gerado! Código ${d.printer.code} — reimprima o adesivo.`);
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
      body: JSON.stringify({ tiers: parsed, promo: { enabled: promoOn, title: promoTitle, description: promoDesc }, coupons: coupons.map((c) => ({ code: c.code, percentOff: Number(c.percentOff), active: c.active, singleUse: !!c.singleUse })) }),
    });
    const d = await r.json();
    if (!r.ok) { setPriceMsg("⚠️ " + (d.error ?? "Erro ao salvar")); return; }
    setPriceMsg("✅ Preços e promoção atualizados! Já estão valendo no site.");
    load(key);
  }

  async function saveSite() {
    setSiteMsg("");
    const r = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ site: { siteName: sName, tagline: sTag, heroBadge: sBadge, heroTitle: sTitle, heroSub: sSub, footerNote: sFoot } }),
    });
    const d = await r.json();
    if (!r.ok) { setSiteMsg("⚠️ " + (d.error ?? "Erro ao salvar")); return; }
    setSiteMsg("✅ Textos do site atualizados!");
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

  async function loadFin() {
    setFinMsg("");
    const r = await fetch("/api/admin/finance", { headers: { "x-admin-key": key } });
    const d = await r.json();
    if (!r.ok) { setFinMsg("⚠️ " + (d.error ?? "Erro")); return; }
    setFin(d);
  }

  async function refundJob(jobId: string) {
    if (!confirm("Estornar o Pix deste pedido no Mercado Pago?")) return;
    setFinMsg("");
    const r = await fetch("/api/admin/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ jobId }),
    });
    const d = await r.json();
    if (!r.ok) { setFinMsg("⚠️ " + (d.error ?? "Erro no estorno")); return; }
    setFinMsg("✅ Estornado no Mercado Pago.");
    loadFin();
  }

  async function loadSec() {
    setSecMsg("");
    const r = await fetch("/api/admin/security", { headers: { "x-admin-key": key } });
    const d = await r.json();
    if (!r.ok) { setSecMsg("⚠️ " + (d.error ?? "Erro")); return; }
    setSec(d);
  }

  async function secPost(body: any, okMsg: string) {
    setSecMsg("");
    const r = await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) { setSecMsg("⚠️ " + (d.error ?? "Erro")); return null; }
    setSecMsg("✅ " + okMsg);
    loadSec();
    return d;
  }

  const orders = useMemo(() => {
    const out: any[] = [];
    for (const p of data?.printers ?? []) {
      for (const j of p.recentJobs ?? []) out.push({ ...j, printerName: p.name });
    }
    out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return orderFilter === "all" ? out : out.filter((j) => j.status === orderFilter);
  }, [data, orderFilter]);

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
          {loginMfa && (
            <input value={loginTotp} onChange={(e) => setLoginTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="Código do app (MFA)" inputMode="numeric" className="input mt-3 text-center font-mono tracking-[0.3em]" autoFocus />
          )}
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
    <main className="min-h-screen font-sans bg-[#f6f7f9]">
      {/* topbar */}
      <header className="sticky top-0 z-20 bg-ink-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-pop">⎙</div>
            <div>
              <p className="font-extrabold leading-none">SafePrint • Console</p>
              <p className="text-[11px] text-white/50 font-medium">gestão multinacional das máquinas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => load(key)} className="text-xs font-bold border border-white/20 rounded-xl px-3 py-2 hover:bg-white/10">↻ Atualizar</button>
            <button onClick={() => { sessionStorage.removeItem("sp-admin"); setAuthed(false); setData(null); }} className="text-xs font-bold border border-white/20 rounded-xl px-3 py-2 text-red-300 hover:bg-white/10">Sair</button>
          </div>
        </div>
        {/* menu */}
        <nav className="max-w-6xl mx-auto px-4 pb-3 flex gap-1.5 overflow-x-auto">
          {TABS.map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 text-xs font-extrabold rounded-xl px-3.5 py-2.5 whitespace-nowrap transition ${tab === id ? "bg-white text-ink-900" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
              <span>{icon}</span>{label}
              {id === "reembolsos" && refunds.filter((r: any) => r.status === "open").length > 0 && (
                <span className="size-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{refunds.filter((r: any) => r.status === "open").length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-5 space-y-4 pb-12">
        {loading && <p className="text-center text-xs font-bold text-ink-300">Carregando…</p>}

        {/* ============ VISÃO GERAL ============ */}
        {tab === "dash" && (
          <>
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

            <div className="grid md:grid-cols-2 gap-3">
              {printers.map((p) => {
                const pct = Math.min(100, Math.round((p.paperCurrent / Math.max(1, p.paperCapacity)) * 100));
                const low = p.paperCurrent <= p.paperAlertAt;
                return (
                  <button key={p.id} onClick={() => { select(p); setTab("locais"); }}
                    className="card p-4 text-left transition hover:border-brand-300">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-extrabold">{p.name}</p>
                        <p className="text-xs text-ink-400 font-medium">{p.location} • código {p.code}</p>
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
          </>
        )}

        {/* ============ PEDIDOS ============ */}
        {tab === "pedidos" && (
          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <p className="font-extrabold text-lg tracking-tight">🧾 Pedidos ({orders.length})</p>
              <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} className="input !w-auto !py-2 text-sm">
                <option value="all">Todos</option>
                <option value="awaiting_payment">Aguard. pagto</option>
                <option value="queued">Na fila</option>
                <option value="printing">Imprimindo</option>
                <option value="done">Concluídos</option>
                <option value="failed">Falhas</option>
                <option value="expired">Expirados</option>
              </select>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-ink-100">
              <table className="w-full text-xs">
                <thead><tr className="bg-ink-50 text-ink-400 text-left">
                  {["Data", "Máquina", "Arquivo", "Folhas", "Total", "Status"].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {orders.slice(0, 60).map((j: any) => {
                    const [sl, sc] = STATUS_LABEL[j.status] ?? [j.status, "bg-ink-50 text-ink-500 border-ink-200"];
                    return (
                      <tr key={j.id} className="border-t border-ink-100">
                        <td className="px-3 py-2 whitespace-nowrap">{dt(j.createdAt)}</td>
                        <td className="px-3 py-2 font-bold">{j.printerName}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{j.fileName}</td>
                        <td className="px-3 py-2">{j.sheets} ({j.copies}×)</td>
                        <td className="px-3 py-2 font-bold">{brl(j.totalCents)}</td>
                        <td className="px-3 py-2"><span className={`chip border ${sc}`}>{sl}</span></td>
                      </tr>
                    );
                  })}
                  {!orders.length && <tr><td colSpan={6} className="px-3 py-4 text-center text-ink-300 font-medium">Nenhum pedido.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============ LOCAIS ============ */}
        {tab === "locais" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-extrabold text-lg tracking-tight">📍 Locais e impressoras ({printers.length})</p>
              <button onClick={() => setShowNew(!showNew)} className="bg-ink-900 text-white text-sm font-bold px-5 py-2.5 rounded-2xl hover:bg-ink-800">+ Novo local</button>
            </div>

            {showNew && (
              <div className="card p-5 space-y-3 border-brand-300">
                <p className="font-extrabold">Novo local</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-ink-500">Nome da unidade *
                    <input value={nName} onChange={(e) => setNName(e.target.value)} className="input mt-1" placeholder="UniFACEF — Bloco B" /></label>
                  <label className="text-xs font-bold text-ink-500">Código 6 dígitos (vazio = gera)
                    <input value={nCode} onChange={(e) => setNCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="input mt-1 font-mono" placeholder="auto" /></label>
                  <label className="text-xs font-bold text-ink-500">Local / sala
                    <input value={nLoc} onChange={(e) => setNLoc(e.target.value)} className="input mt-1" placeholder="Bloco B, 2º andar" /></label>
                  <label className="text-xs font-bold text-ink-500">Endereço
                    <input value={nAddr} onChange={(e) => setNAddr(e.target.value)} className="input mt-1" placeholder="Av. ..., Franca/SP" /></label>
                  <label className="text-xs font-bold text-ink-500">Capacidade de papel
                    <input type="number" value={nCap} onChange={(e) => setNCap(e.target.value)} className="input mt-1" /></label>
                  <label className="text-xs font-bold text-ink-500">Papel inicial
                    <input type="number" value={nQty} onChange={(e) => setNQty(e.target.value)} className="input mt-1" /></label>
                </div>
                <div className="flex gap-2">
                  <button onClick={createPrinter} className="bg-emerald-500 text-white text-sm font-bold px-5 py-2.5 rounded-2xl">Criar local</button>
                  <button onClick={() => setShowNew(false)} className="text-sm font-bold text-ink-400 px-4">Cancelar</button>
                </div>
                {msg && <p className="text-sm font-bold">{msg}</p>}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {printers.map((p) => (
                <button key={p.id} onClick={() => select(p)}
                  className={`card p-4 text-left transition ${selectedId === p.id ? "ring-4 ring-brand-500/20 border-brand-400" : "hover:border-brand-300"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold">{p.name}</p>
                      <p className="text-xs text-ink-400 font-medium">{p.location} • código {p.code}</p>
                    </div>
                    <span className={`chip border ${p.status === "online" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : p.status === "maintenance" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                      {p.status === "online" ? "● online" : p.status === "maintenance" ? "● manutenção" : "● offline"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-ink-500">🧻 {p.paperCurrent}/{p.paperCapacity} • {brl(p.revenue)} • {p.jobs} pedidos</div>
                </button>
              ))}
            </div>

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

                <div className="rounded-2xl bg-ink-900 text-white p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-[11px] font-bold text-white/50">CÓDIGO DA MÁQUINA</p>
                    <p className="font-mono font-extrabold text-2xl tracking-[0.3em]">{sel.code}</p>
                  </div>
                  <button onClick={regenQr} className="text-xs font-bold border border-white/25 rounded-xl px-3 py-2 hover:bg-white/10">🔄 Novo QR + código</button>
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
                  <div className="flex items-end gap-2 mt-3">
                    <label className="text-xs font-bold text-ink-500 flex-1">Código da máquina (6 dígitos)
                      <input value={fCode} onChange={(e) => setFCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="012345" className="input mt-1 font-mono text-center tracking-[0.3em]" /></label>
                    <button onClick={() => setFCode(String(Math.floor(Math.random() * 1000000)).padStart(6, "0"))} className="text-xs font-bold border border-ink-200 bg-white rounded-xl px-3 py-2.5 whitespace-nowrap">🎲 Gerar</button>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={savePrinter} className="bg-ink-900 text-white text-sm font-bold px-5 py-2.5 rounded-2xl hover:bg-ink-800">Salvar alterações</button>
                    <button onClick={deletePrinter} className="text-sm font-bold border border-red-300 text-red-500 px-5 py-2.5 rounded-2xl">🗑️ Excluir local</button>
                  </div>
                  {msg && <p className="text-sm font-bold mt-2">{msg}</p>}
                </div>

                <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4">
                  <p className="font-extrabold text-sm mb-3">📍 Unidade / local da máquina</p>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <label className="text-xs font-bold text-ink-500">Nome da unidade
                      <input value={fName} onChange={(e) => setFName(e.target.value)} className="input mt-1" /></label>
                    <label className="text-xs font-bold text-ink-500">Local / sala
                      <input value={fLoc} onChange={(e) => setFLoc(e.target.value)} className="input mt-1" /></label>
                    <label className="text-xs font-bold text-ink-500">Endereço
                      <input value={fAddr} onChange={(e) => setFAddr(e.target.value)} className="input mt-1" /></label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ PREÇOS ============ */}
        {tab === "precos" && (
          <div className="card p-5 md:p-6 space-y-5">
            <div>
              <p className="font-extrabold text-lg tracking-tight">🏷️ Preços & promoções</p>
              <p className="text-xs text-ink-400 font-medium mt-0.5">Vale para todas as máquinas.</p>
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
                <label className="flex items-center gap-1 text-xs font-bold text-ink-500" title="Vale 1x no total (queima após o primeiro pedido)">
                  <input type="checkbox" checked={!!c.singleUse} onChange={(e) => setCoupons(coupons.map((x, j) => j === i ? { ...x, singleUse: e.target.checked } : x))} className="size-4 accent-ink-900" /> 1x
                </label>
                  <button onClick={() => setCoupons(coupons.filter((_, j) => j !== i))} className="text-xs font-bold text-red-400 px-2">✕</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newCoupon} onChange={(e) => setNewCoupon(e.target.value)} className="input !py-2.5 flex-1 uppercase font-mono" placeholder="NOVO CUPOM" />
                <input value={newCouponPct} inputMode="numeric" onChange={(e) => setNewCouponPct(e.target.value)} className="input !py-2.5 w-24" placeholder="%" />
                <button onClick={() => { if (newCoupon.trim() && newCouponPct) { setCoupons([...coupons, { code: newCoupon, percentOff: newCouponPct, active: true }]); setNewCoupon(""); setNewCouponPct(""); } }} className="text-xs font-extrabold text-brand-600">+ adicionar</button>
              </div>
            </div>

            <button onClick={savePricing} className="bg-ink-900 text-white text-sm font-bold px-5 py-2.5 rounded-2xl hover:bg-ink-800">Salvar preços e promoção</button>
            {priceMsg && <p className="text-sm font-bold">{priceMsg}</p>}
          </div>
        )}

        {/* ============ FINANCEIRO ============ */}
        {tab === "financeiro" && (
          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-extrabold text-lg tracking-tight">💰 Central financeira (Mercado Pago)</p>
              <button onClick={loadFin} className="text-xs font-bold border border-ink-200 bg-white rounded-xl px-3 py-2">↻ Carregar pagamentos</button>
            </div>
            {finMsg && <p className="text-sm font-bold mt-2">{finMsg}</p>}
            {fin ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 py-3">
                    <p className="text-[11px] font-bold text-emerald-600">Recebido</p>
                    <p className="font-extrabold">{brl(fin.totals.receivedCents)}</p>
                  </div>
                  <div className="rounded-2xl bg-red-50 border border-red-200 py-3">
                    <p className="text-[11px] font-bold text-red-500">Estornado</p>
                    <p className="font-extrabold">{brl(fin.totals.refundedCents)}</p>
                  </div>
                  <div className="rounded-2xl bg-ink-50 border border-ink-100 py-3">
                    <p className="text-[11px] font-bold text-ink-400">Pedidos</p>
                    <p className="font-extrabold">{fin.totals.count}</p>
                  </div>
                </div>
                {!fin.mpEnabled && <p className="hint">⚠️ Sem MERCADOPAGO_ACCESS_TOKEN na VPS — Pix automático desligado.</p>}
                <div className="overflow-x-auto rounded-2xl border border-ink-100">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-ink-50 text-ink-400 text-left">
                      {["Data", "Arquivo", "Total", "MP id", "Status", ""].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {(fin.jobs ?? []).map((j: any) => (
                        <tr key={j.id} className="border-t border-ink-100">
                          <td className="px-3 py-2 whitespace-nowrap">{dt(j.createdAt)}</td>
                          <td className="px-3 py-2 font-bold max-w-[130px] truncate">{j.fileName}</td>
                          <td className="px-3 py-2 font-bold">{brl(j.totalCents)}</td>
                          <td className="px-3 py-2 font-mono">{j.mpPaymentId ?? "—"}</td>
                          <td className="px-3 py-2">{j.mpRefunded ? "estornado" : j.status}</td>
                          <td className="px-3 py-2">{!j.mpRefunded && j.mpPaymentId ? (
                            <button onClick={() => refundJob(j.id)} className="text-[11px] font-extrabold border border-red-300 text-red-500 rounded-xl px-3 py-1.5">Estornar</button>
                          ) : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <p className="hint mt-2">Carregue para ver Pix recebidos e estornar sem abrir o Mercado Pago.</p>}
          </div>
        )}

        {/* ============ REEMBOLSOS ============ */}
        {tab === "reembolsos" && (
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
        )}

        {/* ============ SITE ============ */}
        {tab === "site" && (
          <div className="card p-5 md:p-6 space-y-4">
            <div>
              <p className="font-extrabold text-lg tracking-tight">🎨 Personalização do site</p>
              <p className="text-xs text-ink-400 font-medium mt-0.5">Textos da página inicial. Vale na hora após salvar.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-ink-500">Nome da plataforma
                <input value={sName} onChange={(e) => setSName(e.target.value)} className="input mt-1" placeholder="SafePrint" /></label>
              <label className="text-xs font-bold text-ink-500">Slogan
                <input value={sTag} onChange={(e) => setSTag(e.target.value)} className="input mt-1" placeholder="Impressão autoatendimento" /></label>
            </div>
            <label className="text-xs font-bold text-ink-500 block">Selo do topo
              <input value={sBadge} onChange={(e) => setSBadge(e.target.value)} className="input mt-1" /></label>
            <label className="text-xs font-bold text-ink-500 block">Título principal
              <input value={sTitle} onChange={(e) => setSTitle(e.target.value)} className="input mt-1" /></label>
            <label className="text-xs font-bold text-ink-500 block">Subtítulo
              <textarea value={sSub} onChange={(e) => setSSub(e.target.value)} rows={3} className="input mt-1 resize-none" /></label>
            <label className="text-xs font-bold text-ink-500 block">Nota do rodapé
              <input value={sFoot} onChange={(e) => setSFoot(e.target.value)} className="input mt-1" /></label>
            <button onClick={saveSite} className="bg-ink-900 text-white text-sm font-bold px-5 py-2.5 rounded-2xl hover:bg-ink-800">Salvar site</button>
            {siteMsg && <p className="text-sm font-bold">{siteMsg}</p>}
          </div>
        )}

        {/* ============ SEGURANÇA ============ */}
        {tab === "seg" && (
          <div className="space-y-4">
            <div className="card p-5 md:p-6 space-y-4">
              <div>
                <p className="font-extrabold text-lg tracking-tight">🔐 Segurança e acesso</p>
                <p className="text-xs text-ink-400 font-medium mt-0.5">Senha com hash, segundo fator (MFA) e sessões com expiração de 12h.</p>
              </div>
              {secMsg && <p className="text-sm font-bold">{secMsg}</p>}
              {!sec ? (
                <button onClick={loadSec} className="text-xs font-bold border border-ink-200 bg-white rounded-xl px-3 py-2">Carregar</button>
              ) : (
                <>
                  <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4 space-y-3">
                    <p className="font-extrabold text-sm">Trocar senha {sec.hasCustomPassword ? "(hash bcrypt ativo)" : "(usando .env)"}</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="text-xs font-bold text-ink-500">Senha atual
                        <input type="password" value={pwCur} onChange={(e) => setPwCur(e.target.value)} className="input mt-1" /></label>
                      <label className="text-xs font-bold text-ink-500">Nova senha (8+ caracteres)
                        <input type="password" value={pwNext} onChange={(e) => setPwNext(e.target.value)} className="input mt-1" /></label>
                    </div>
                    <button onClick={async () => { const d = await secPost({ action: "change-password", current: pwCur, next: pwNext }, "Senha trocada!"); if (d) { setPwCur(""); setPwNext(""); } }} className="bg-ink-900 text-white text-sm font-bold px-5 py-2.5 rounded-2xl">Trocar senha</button>
                  </div>

                  <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4 space-y-3">
                    <p className="font-extrabold text-sm">Segundo fator (MFA) — {sec.mfaEnabled ? "✅ ativado" : "⚪ desativado"}</p>
                    {!sec.mfaEnabled ? (
                      <>
                        <button onClick={async () => { const d = await secPost({ action: "mfa-setup" }, "Escaneie o código no app autenticador e confirme abaixo."); if (d) { setMfaSecret(d.secret); setMfaUrl(d.url); } }} className="text-xs font-bold border border-ink-200 bg-white rounded-xl px-3 py-2">Gerar segredo MFA</button>
                        {mfaSecret && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-ink-500">Chave (ou abra a URL no autenticador):</p>
                            <code className="block font-mono text-sm bg-white border border-ink-200 rounded-xl p-3 break-all">{mfaSecret}</code>
                            <a href={mfaUrl} className="text-xs font-bold text-brand-600 underline break-all">Abrir no app autenticador</a>
                            <div className="flex gap-2">
                              <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" className="input font-mono text-center tracking-[0.3em]" />
                              <button onClick={async () => { const d = await secPost({ action: "mfa-enable", totp: mfaCode }, "MFA ativado!"); if (d) { setMfaSecret(""); setMfaCode(""); } }} className="bg-emerald-500 text-white text-sm font-bold px-5 rounded-2xl whitespace-nowrap">Ativar</button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <button onClick={async () => { const pw = prompt("Digite a senha atual para desativar o MFA:"); if (pw) await secPost({ action: "mfa-disable", password: pw }, "MFA desativado."); }} className="text-xs font-bold border border-red-300 text-red-500 rounded-xl px-3 py-2">Desativar MFA</button>
                    )}
                  </div>

                  <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-extrabold text-sm">Sessões ativas ({(sec.sessions ?? []).length})</p>
                      <button onClick={() => secPost({ action: "revoke-others" }, "Outras sessões derrubadas.")} className="text-xs font-bold border border-ink-200 bg-white rounded-xl px-3 py-2">Derrubar outras</button>
                    </div>
                    {(sec.sessions ?? []).map((s: any) => (
                      <div key={s.token} className="flex items-center justify-between text-xs bg-white border border-ink-100 rounded-xl px-3 py-2">
                        <span className="font-medium">desde {dt(s.createdAt)} • expira {dt(s.expiresAt)} {s.current && <b>(esta)</b>}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
