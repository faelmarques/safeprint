"use client";

import { useEffect, useMemo, useState } from "react";
import { brl, calcSheets, calcTotal, parsePageRange } from "@/lib/pricing";
import type { Printer } from "@/lib/printers";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS = ["Local", "Arquivo", "Ajustes", "Pagamento", "Retirada"];

export default function Home() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [slug, setSlug] = useState("");
  const [step, setStep] = useState<Step>(1);

  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [fileType, setFileType] = useState<"pdf" | "image">("pdf");
  const [totalPages, setTotalPages] = useState(1);
  const [range, setRange] = useState("todas");
  const [copies, setCopies] = useState(1);

  const [imgScale, setImgScale] = useState(80);
  const [imgX, setImgX] = useState(50);
  const [imgY, setImgY] = useState(50);

  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showRefund, setShowRefund] = useState(false);
  const [refundPhoto, setRefundPhoto] = useState("");
  const [refundMotive, setRefundMotive] = useState("");
  const [refundDesc, setRefundDesc] = useState("");
  const [refundName, setRefundName] = useState("");
  const [refundZap, setRefundZap] = useState("");
  const [refundOk, setRefundOk] = useState("");
  const [confirmedOk, setConfirmedOk] = useState(false);

  const MOTIVES = [
    "Não saiu a quantidade correta",
    "Não saiu a minha impressão",
    "Minha impressão saiu falhada",
    "Outro",
  ];

  const printer = useMemo(() => printers.find((p) => p.slug === slug || p.id === slug), [printers, slug]);

  useEffect(() => {
    fetch("/api/printers").then((r) => r.json()).then((d) => {
      setPrinters(d.printers ?? []);
      const q = new URLSearchParams(window.location.search).get("p");
      if (q) {
        const found = (d.printers ?? []).find((p: Printer) => p.slug === q || p.id === q);
        if (found) { setSlug(found.slug); setStep(2); }
      }
    }).catch(() => {});
  }, []);

  const pages = useMemo(() => parsePageRange(range, totalPages), [range, totalPages]);
  // Impressora somente frente: 1 página por folha
  const sheets = calcSheets(pages.length || 0, copies, false);
  const price = useMemo(() => (printer ? calcTotal(sheets, printer.tiers) : { sheets, unitCents: 0, totalCents: 0 }), [sheets, printer]);

  async function handleFile(f: File) {
    setErr(""); setFile(f);
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    setFileType(isPdf ? "pdf" : "image");
    const du = await new Promise<string>((res) => {
      const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f);
    });
    setFileDataUrl(du);
    if (isPdf) {
      try {
        const pdfjs = await import("pdfjs-dist");
        // @ts-ignore
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        const buf = await f.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        setTotalPages(pdf.numPages);
      } catch { setTotalPages(10); }
      setRange("todas");
    } else { setTotalPages(1); setRange("todas"); }
    setStep(3);
  }

  async function createJob() {
    if (!printer) { setErr("Escolha a impressora"); return; }
    if (!pages.length) { setErr("Selecione ao menos 1 página (ex: todas ou 1-3,5)"); return; }
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerSlug: printer.slug, fileName: file?.name ?? "documento",
          fileType, pages, copies, duplex: false,
          fileDataUrl: fileType === "image" ? fileDataUrl : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao criar pedido");
      setJobId(d.job.id);
      setStep(4);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function mockPay() {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/jobs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro no pagamento");
      setStep(5);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function sendRefund() {
    setLoading(true); setRefundOk(""); setErr("");
    try {
      const r = await fetch("/api/refunds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, motive: refundMotive, description: refundDesc, name: refundName, whatsapp: refundZap, photoDataUrl: refundPhoto }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro");
      setRefundOk(d.message);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen font-sans">
      {/* NAV */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-ink-100">
        <div className="mx-auto max-w-3xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-2xl bg-gradient-to-br from-brand-500 to-ink-900 flex items-center justify-center text-white text-lg shadow-pop">⎙</div>
            <div>
              <p className="font-extrabold tracking-tight leading-none text-[17px]">SafePrint</p>
              <p className="text-[11px] text-ink-400 font-medium">Impressão autoatendimento • Franca</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-xs font-bold text-ink-400 hover:text-ink-900 hidden sm:block">← Início</a>
            <span className="chip bg-emerald-50 text-emerald-700 border border-emerald-200 hidden sm:inline-flex">● P&B laser A4</span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <div className="bg-gradient-to-br from-ink-900 via-ink-900 to-brand-800 text-white">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <p className="chip bg-white/10 text-brand-100 border border-white/15 mb-3">📍 {printer ? printer.name : "Escaneie o QR da máquina"}</p>
          <h1 className="font-display font-extrabold tracking-tight text-[28px] leading-[1.1]">Imprima seu trabalho<br />em menos de 1 minuto.</h1>
          <p className="text-sm text-white/70 mt-2 font-medium">Envie o PDF, pague no Pix e retire na saída da caixa. Sem fila, sem papelaria.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {[["1–4 fls", "R$ 1,35"], ["5–9 fls", "R$ 1,25"], ["10+ fls", "R$ 1,15"]].map(([a, b]) => (
              <span key={a} className="chip bg-white text-ink-900 font-extrabold">{a} • {b}<span className="font-medium text-ink-400">/folha</span></span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6 space-y-5 pb-16">
        {/* STEPPER */}
        <div className="card p-4 flex items-center gap-1 overflow-x-auto">
          {STEPS.map((l, i) => {
            const n = i + 1;
            const active = step === n, done = step > n;
            return (
              <div key={l} className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className={`stepdot ${done ? "bg-emerald-500 text-white" : active ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-400"}`}>{done ? "✓" : n}</span>
                <span className={`text-xs font-bold truncate ${active || done ? "text-ink-900" : "text-ink-300"}`}>{l}</span>
                {n < 5 && <span className="flex-1 h-px bg-ink-100 mx-1" />}
              </div>
            );
          })}
        </div>

        {err && <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm font-semibold">⚠️ {err}</div>}

        {step === 1 && (
          <section className="card p-6 space-y-4">
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">Onde você está?</h2>
              <p className="hint">Pelo QR a máquina já vem selecionada. Senão, toque na unidade:</p>
            </div>
            <div className="grid gap-3">
              {printers.map((p) => {
                const sel = slug === p.slug;
                return (
                  <button key={p.id} onClick={() => { setSlug(p.slug); setStep(2); }}
                    className={`text-left rounded-2xl border-2 p-4 transition bg-white ${sel ? "border-brand-500 ring-4 ring-brand-500/10" : "border-ink-100 hover:border-brand-300"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-extrabold text-[15px]">{p.name}</p>
                        <p className="text-xs text-ink-400 font-medium">{p.location}</p>
                      </div>
                      <span className={`chip ${p.status === "online" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                        {p.status === "online" ? "● disponível" : "● offline"}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3 text-[11px] font-bold">
                      <span className="chip bg-ink-50 text-ink-600 border border-ink-100">🧻 {p.paperCurrent} folhas</span>
                      <span className="chip bg-brand-50 text-brand-700 border border-brand-100">a partir de {brl(Math.min(...p.tiers.map((t) => t.pricePerSheetCents)))}/folha</span>
                      <span className="chip bg-ink-50 text-ink-600 border border-ink-100">1 pág/folha</span>
                    </div>
                  </button>
                );
              })}
              {!printers.length && <p className="hint">Carregando impressoras…</p>}
            </div>
          </section>
        )}

        {step >= 2 && printer && (
          <div className="card px-4 py-3 flex items-center justify-between">
            <p className="text-[13px]"><span className="text-ink-400 font-medium">Imprimindo em</span> <b>{printer.name}</b> <span className="text-ink-400">• {printer.location}</span></p>
            <button className="text-xs font-bold text-brand-600 hover:underline shrink-0 ml-3" onClick={() => setStep(1)}>Trocar</button>
          </div>
        )}

        {step === 2 && (
          <section className="card p-6 space-y-4">
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">Envie o arquivo</h2>
              <p className="hint">PDF, JPG ou PNG • apagado após imprimir (LGPD)</p>
            </div>
            <label className="block rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition">
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <div className="mx-auto size-14 rounded-2xl bg-ink-900 text-white flex items-center justify-center text-2xl shadow-card">⇪</div>
              <p className="mt-3 font-extrabold text-[15px]">Toque para escolher o arquivo</p>
              <p className="hint">Trabalho da faculdade, currículo, boleto…</p>
            </label>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["🔒", "Privado"], ["⚡", "~30 segundos"], ["🧾", "Pix na hora"]].map(([i, t]) => (
                <div key={t} className="rounded-2xl bg-ink-50 border border-ink-100 py-2.5 text-xs font-bold text-ink-600">{i} {t}</div>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="card p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-lg tracking-tight">Ajustes de impressão</h2>
                <p className="hint">📄 {file?.name} • {totalPages} pág(s) no arquivo • somente frente</p>
              </div>
              <span className="chip bg-ink-900 text-white shrink-0">1 pág / folha</span>
            </div>

            {fileType === "pdf" ? (
              <div className="space-y-2">
                <p className="label">Quais páginas imprimir?</p>
                <div className="flex gap-2">
                  {["todas", "1-3,5"].map((v) => (
                    <button key={v} onClick={() => setRange(v)} className={`chip border-2 px-3 py-1.5 cursor-pointer ${range === v ? "border-ink-900 bg-ink-900 text-white" : "border-ink-100 bg-white text-ink-500"}`}>{v}</button>
                  ))}
                </div>
                <input value={range} onChange={(e) => setRange(e.target.value)} className="input font-mono" placeholder="todas" />
                <p className="hint">{pages.length ? <>✅ {pages.length} pág(s): {pages.slice(0, 10).join(", ")}{pages.length > 10 ? "…" : ""}</> : "Digite ex: todas ou 1-3,5"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="label">🖼️ Ajuste a imagem na folha A4</p>
                <div className="flex gap-4 items-start">
                  <div className="relative bg-white rounded-xl overflow-hidden border border-ink-200 shadow-card shrink-0" style={{ width: 168, height: 238 }}>
                    {fileDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileDataUrl} alt="preview" style={{ position: "absolute", left: `${imgX}%`, top: `${imgY}%`, width: `${imgScale}%`, transform: "translate(-50%,-50%)" }} />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div><p className="label">Tamanho — {imgScale}%</p><input type="range" min={10} max={100} value={imgScale} onChange={(e) => setImgScale(Number(e.target.value))} className="w-full accent-ink-900" /></div>
                    <div><p className="label">Horizontal</p><input type="range" min={0} max={100} value={imgX} onChange={(e) => setImgX(Number(e.target.value))} className="w-full accent-ink-900" /></div>
                    <div><p className="label">Vertical</p><input type="range" min={0} max={100} value={imgY} onChange={(e) => setImgY(Number(e.target.value))} className="w-full accent-ink-900" /></div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="label mb-2">Quantas cópias?</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setCopies(Math.max(1, copies - 1))} className="size-11 rounded-2xl border border-ink-200 font-extrabold text-lg hover:border-ink-900">−</button>
                <span className="text-2xl font-extrabold w-10 text-center">{copies}</span>
                <button onClick={() => setCopies(Math.min(50, copies + 1))} className="size-11 rounded-2xl bg-ink-900 text-white font-extrabold text-lg">+</button>
                <span className="hint ml-1">máx. 50</span>
              </div>
            </div>

            <div className="rounded-3xl bg-ink-900 text-white p-5 shadow-card">
              <div className="flex justify-between text-sm font-medium text-white/70">
                <span>{pages.length} pág(s) × {copies} cópia(s) = <b className="text-white">{sheets} folha(s)</b></span>
                <span>{brl(price.unitCents)}/folha</span>
              </div>
              <p className="text-[11px] text-white/50 mt-1">1–4 fls R$1,35 • 5–9 fls R$1,25 • 10+ fls R$1,15 • somente frente</p>
              <p className="font-display font-extrabold text-[26px] mt-1">Total {brl(price.totalCents)}</p>
              <button disabled={loading} onClick={createJob} className="mt-3 w-full bg-white text-ink-900 font-extrabold rounded-2xl py-3.5 hover:bg-brand-50 disabled:opacity-50">
                {loading ? "Gerando pedido…" : "Continuar para pagamento →"}
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="card p-6 space-y-4 text-center">
            <h2 className="font-extrabold text-lg tracking-tight">Pagamento via Pix</h2>
            <p className="font-display font-extrabold text-3xl">{brl(price.totalCents)}</p>
            <p className="hint">{sheets} folha(s) × {brl(price.unitCents)} • {printer?.name}</p>
            <div className="mx-auto size-48 rounded-3xl bg-ink-900 text-white flex flex-col items-center justify-center gap-1 shadow-card">
              <span className="text-3xl">◇</span>
              <span className="text-xs font-bold">QR PIX aqui</span>
              <span className="text-[10px] text-white/60 px-4">Mercado Pago no deploy — confirma automático</span>
            </div>
            <button disabled={loading} onClick={mockPay} className="btn-primary">{loading ? "Confirmando…" : "Já paguei — liberar impressão"}</button>
            <p className="hint">MVP: botão simula a confirmação do banco.</p>
          </section>
        )}

        {step === 5 && (
          <section className="card p-6 space-y-4 text-center border-emerald-200">
            <div className="mx-auto size-14 rounded-full bg-emerald-500 text-white flex items-center justify-center text-2xl font-extrabold">✓</div>
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">Na fila! Retire na máquina</h2>
              <p className="hint">Pedido <code className="font-mono bg-ink-50 px-1.5 py-0.5 rounded">{jobId.slice(0, 8)}</code> • {sheets} folha(s) • aguarde ~30s na saída da caixa</p>
            </div>
            {!confirmedOk && !showRefund && (
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => setConfirmedOk(true)} className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold py-3.5 text-sm shadow-card transition active:scale-[.98]">
                  ✅ Saiu tudo certo
                </button>
                <button onClick={() => setShowRefund(true)} className="rounded-2xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold py-3.5 text-sm transition active:scale-[.98]">
                  ⚠️ Algo deu errado
                </button>
              </div>
            )}
            {confirmedOk && (
              <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-5">
                <p className="font-extrabold text-emerald-700">Valeu! 🎓</p>
                <p className="text-sm text-emerald-600 font-medium mt-1">Impressão confirmada e pagamento recebido. Volte sempre!</p>
              </div>
            )}
            {showRefund && (
              <div className="text-left rounded-3xl bg-white border border-amber-200 p-5 space-y-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold tracking-tight">Solicitar análise de reembolso</p>
                    <p className="hint">Pedido <code className="font-mono bg-ink-50 px-1.5 py-0.5 rounded">{jobId.slice(0, 8)}</code> • respondemos no seu WhatsApp</p>
                  </div>
                  <button onClick={() => setShowRefund(false)} className="text-xs font-bold text-ink-400 hover:text-ink-900 shrink-0">← voltar</button>
                </div>

                <div>
                  <p className="label mb-2">1. O que aconteceu? *</p>
                  <div className="grid gap-2">
                    {[
                      ["quantidade_incorreta", "Não saiu a quantidade correta"],
                      ["nao_saiu", "Não saiu a minha impressão"],
                      ["saiu_falhada", "Minha impressão saiu falhada"],
                      ["outro", "Outro"],
                    ].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setRefundMotive(v)}
                        className={`flex items-center gap-2.5 text-left rounded-2xl border-2 px-3.5 py-2.5 text-sm font-bold transition ${refundMotive === v ? "border-ink-900 bg-ink-900 text-white" : "border-ink-100 bg-white text-ink-600 hover:border-ink-300"}`}>
                        <span className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${refundMotive === v ? "border-white" : "border-ink-200"}`}>
                          {refundMotive === v && <span className="size-2.5 rounded-full bg-white" />}
                        </span>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="label mb-1.5">2. Explique o que aconteceu *</p>
                  <textarea value={refundDesc} onChange={(e) => setRefundDesc(e.target.value)} rows={3}
                    placeholder="Ex: pedi 8 folhas e saíram só 5, as últimas vieram em branco…"
                    className="input resize-none" />
                </div>

                <div>
                  <p className="label mb-1.5">3. Foto da impressão (ou da saída vazia) *</p>
                  <label className="block rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 p-4 text-center cursor-pointer hover:border-amber-400 text-sm font-bold text-ink-500">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const r = new FileReader(); r.onload = () => setRefundPhoto(String(r.result)); r.readAsDataURL(f);
                    }} />
                    {refundPhoto ? "📷 Trocar foto" : "📷 Toque para tirar a foto"}
                  </label>
                  {refundPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={refundPhoto} alt="defeito" className="rounded-2xl max-h-52 mx-auto border border-ink-200 mt-2" />
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="label mb-1.5">4. Nome completo *</p>
                    <input value={refundName} onChange={(e) => setRefundName(e.target.value)} placeholder="Seu nome" className="input" />
                  </div>
                  <div>
                    <p className="label mb-1.5">WhatsApp para contato *</p>
                    <input value={refundZap} onChange={(e) => setRefundZap(e.target.value)} placeholder="(16) 99999-9999" inputMode="tel" className="input" />
                  </div>
                </div>

                <button disabled={loading} onClick={sendRefund} className="btn-primary !bg-amber-400 !text-ink-900">
                  {loading ? "Enviando…" : "Enviar solicitação de análise"}
                </button>
                {refundOk && <p className="text-sm font-bold text-emerald-600">✅ {refundOk}</p>}
              </div>
            )}
            <button onClick={() => { setStep(1); setFile(null); setJobId(""); setRefundPhoto(""); setRefundOk(""); setRefundMotive(""); setRefundDesc(""); setRefundName(""); setRefundZap(""); setShowRefund(false); setConfirmedOk(false); }} className="text-xs font-bold text-ink-300 underline">Nova impressão</button>
          </section>
        )}

        <footer className="text-center hint pb-6">
          SafePrint • A4 • P&B laser • 1 página por folha • Arquivos excluídos em 24h
        </footer>
      </div>
    </main>
  );
}
