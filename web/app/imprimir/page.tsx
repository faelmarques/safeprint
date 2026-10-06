"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brl, calcSheets, calcTotal, parsePageRange } from "@/lib/pricing";
import { checkUpload } from "@/lib/filefilter";
import type { Printer } from "@/lib/printers";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS = ["Local", "Arquivo", "Ajustes", "Pagamento", "Retirada"];

interface FileEntry {
  f: File;
  dataUrl: string;
  type: "pdf" | "image";
  totalPages: number;
  perSheet: number;
  scale: number;
  x: number;
  y: number;
  rotate: number;
  landscape: boolean;
  thumbs: string[];
}

export default function Home() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [promo, setPromo] = useState<{ enabled: boolean; title: string; description: string } | null>(null);
  const [coupons, setCoupons] = useState<{ code: string; percentOff: number; singleUse?: boolean }[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; percentOff: number; singleUse?: boolean } | null>(null);
  const [dark, setDark] = useState(false);
  const [slug, setSlug] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [codeInput, setCodeInput] = useState("");
  const [codeErr, setCodeErr] = useState("");

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [active, setActive] = useState(0);
  const [range, setRange] = useState("todas");
  const [copies, setCopies] = useState(1);
  const [viewThumb, setViewThumb] = useState("");
  const [pageMode, setPageMode] = useState<"all" | "even" | "odd" | "custom">("all");
  const [showRangeHelp, setShowRangeHelp] = useState(false);
  const [pdfView, setPdfView] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [tourSlide, setTourSlide] = useState(0);

  const [jobIds, setJobIds] = useState<string[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const [loyalty, setLoyalty] = useState(0);
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
  const [lgpdOk, setLgpdOk] = useState(false);
  const [pixQr, setPixQr] = useState("");
  const [pixCopy, setPixCopy] = useState("");
  const [pixId, setPixId] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [offlineMsg, setOfflineMsg] = useState("");
  const [liveStatus, setLiveStatus] = useState("");
  const [queueAhead, setQueueAhead] = useState(0);

  const previewRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const printer = useMemo(() => printers.find((p) => p.slug === slug || p.id === slug), [printers, slug]);
  const activeFile = files[active];

  useEffect(() => {
    const d = localStorage.getItem("sp-dark") === "1";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    setLgpdOk(localStorage.getItem("sp-lgpd") === "1");
    if (localStorage.getItem("sp-tour") !== "1") setShowTour(true);
    fetch("/api/printers").then((r) => r.json()).then((d) => {
      setPrinters(d.printers ?? []);
      setPromo(d.promo ?? null);
      setCoupons(d.coupons ?? []);
      const q = new URLSearchParams(window.location.search).get("p");
      if (q) {
        const found = (d.printers ?? []).find((p: Printer) => p.slug === q || p.id === q);
        if (found) {
          setSlug(found.slug);
          if (found.status === "online") setStep(2);
          else setOfflineMsg(found.status === "maintenance" ? "⚠️ Máquina em pausa (sem papel ou manutenção). Avise o operador ou volte em instantes." : "⚠️ Máquina offline no momento. Volte em instantes.");
        }
      }
    }).catch(() => {});
  }, []);

  function toggleDark() {
    const d = !dark;
    setDark(d);
    localStorage.setItem("sp-dark", d ? "1" : "0");
    document.documentElement.classList.toggle("dark", d);
  }

  const perFile = useMemo(() => files.map((f) => {
    let pages: number[];
    if (pageMode === "custom") pages = parsePageRange(range, f.totalPages);
    else if (pageMode === "even") pages = Array.from({ length: f.totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
    else if (pageMode === "odd") pages = Array.from({ length: f.totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1);
    else pages = Array.from({ length: f.totalPages }, (_, i) => i + 1);
    const sheets = f.type === "image" ? calcSheets(1, copies, false, f.perSheet) : calcSheets(pages.length, copies, false, f.perSheet);
    return { pages, sheets };
  }), [files, range, copies, pageMode, active]);

  const totalSheets = perFile.reduce((s, p) => s + p.sheets, 0);
  const price = useMemo(() => {
    if (!printer) return { sheets: totalSheets, unitCents: 0, totalCents: 0 };
    const base = calcTotal(totalSheets, printer.tiers);
    if (!couponApplied) return base;
    const discount = Math.floor((base.totalCents * couponApplied.percentOff) / 100);
    return { ...base, totalCents: Math.max(0, base.totalCents - discount) };
  }, [totalSheets, printer, couponApplied]);

  function updateActive(patch: Partial<FileEntry>) {
    setFiles(files.map((f, i) => (i === active ? { ...f, ...patch } : f)));
  }

  async function handleFiles(list: FileList | File[]) {
    setErr("");
    const arr = Array.from(list).slice(0, 5);
    for (const f of arr) {
      const problem = checkUpload(f.name, f.type, f.size);
      if (problem) { setErr(`${f.name}: ${problem}`); return; }
    }
    for (const f of arr) {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        // varredura de segurança no PDF (scripts, ações automáticas, embeds)
        const buf = await f.arrayBuffer();
        const magic = String.fromCharCode(...Array.from(new Uint8Array(buf.slice(0, 5))));
        if (!magic.startsWith("%PDF")) { setErr(`${f.name}: arquivo não é um PDF válido`); return; }
        const text = new TextDecoder("latin1").decode(buf);
        const bad = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/RichMedia", "/SubmitForm", "/XFA"].find((p) => text.includes(p));
        if (bad) { setErr(`${f.name}: PDF bloqueado (conteúdo ativo ${bad}). Reexporte com "Imprimir em PDF".`); return; }
      }
    }
    const entries: FileEntry[] = [];
    for (const f of arr) {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      const du = await new Promise<string>((res) => {
        const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f);
      });
      let totalPages = 1;
      if (isPdf) {
        // contagem via pdfjs; fallback: conta entradas /Page no conteúdo
        try {
          const pdfjs = await import("pdfjs-dist");
          // @ts-ignore
          pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
          const buf = await f.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: buf }).promise;
          totalPages = pdf.numPages;
        } catch {
          try {
            const buf = await f.arrayBuffer();
            const text = new TextDecoder("latin1").decode(buf);
            // pega o maior /Count num objeto /Pages (árvore de páginas)
            let best = 0;
            const re = /\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text))) best = Math.max(best, Number(m[1]));
            if (!best) {
              const m2 = text.match(/\/Count\s+(\d+)/g);
              if (m2) best = Math.max(...m2.map((s) => Number(s.match(/\d+/)![0])));
            }
            if (!best) {
              // conta objetos "/Type /Page" (excluindo "/Type /Pages")
              const pages = text.match(/\/Type\s*\/Page[^s]/g);
              if (pages) best = pages.length;
            }
            totalPages = best > 0 ? best : 1;
          } catch { totalPages = 1; }
        }
      }
      entries.push({ f, dataUrl: du, type: isPdf ? "pdf" : "image", totalPages, perSheet: 1, scale: 80, x: 50, y: 50, rotate: 0, landscape: false, thumbs: [] });
      if (isPdf && totalPages > 100) { setErr(`${f.name}: PDFs de mais de 100 páginas não são aceitos. Divida em arquivos menores.`); return; }
    }
    setFiles(entries);
    setActive(0);
    setRange("todas");
    setStep(3);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (activeFile?.type !== "pdf") { setViewThumb(""); return; }
      try {
        const pdfjs = await import("pdfjs-dist");
        // @ts-ignore
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
        const buf = await activeFile.f.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        const sel = perFile[active]?.pages ?? [];
        const idx = Math.min(pdfView, Math.max(0, sel.length - 1));
        const pageNum = sel[idx] ?? 1;
        const page = await pdf.getPage(pageNum);
        const vp = page.getViewport({ scale: 0.9 });
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        // @ts-ignore
        await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        if (!cancelled) setViewThumb(c.toDataURL("image/jpeg", 0.8));
      } catch { if (!cancelled) setViewThumb(""); }
    }
    run();
    return () => { cancelled = true; };
  }, [activeFile, pdfView, perFile, active]);

  function toRangeString(pages: number[], total: number): string {
    if (!pages.length) return "";
    if (pages.length >= total) return "todas";
    const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
    const out: string[] = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) { prev = sorted[i]; continue; }
      out.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = sorted[i]; prev = sorted[i];
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    return out.join(",");
  }

  async function bakeImage(entry: FileEntry): Promise<string> {
    const W = 1240, H = 1754, PAD = 60;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = entry.dataUrl;
    });
    const n = entry.perSheet;
    const cols = n === 1 ? 1 : n <= 2 ? 1 : 2;
    const rows = n === 1 ? 1 : n <= 2 ? n : Math.ceil(n / 2);
    const cw = W / cols, ch = H / rows;
    for (let t = 0; t < n; t++) {
      const cx = (t % cols) * cw, cy = Math.floor(t / cols) * ch;
      if (n === 1) {
        let w = (cw * entry.scale) / 100;
        let h = (img.height / img.width) * w;
        if (entry.rotate % 180 !== 0) { [w, h] = [h, w]; }
        ctx.save();
        ctx.translate(cx + (cw * entry.x) / 100, cy + (ch * entry.y) / 100);
        ctx.rotate((entry.rotate * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        const s = Math.min((cw - PAD) / img.width, (ch - PAD) / img.height);
        const w = img.width * s, h = img.height * s;
        ctx.drawImage(img, cx + (cw - w) / 2, cy + (ch - h) / 2, w, h);
      }
    }
    // canvas → JPEG 0.85: strips EXIF/metadados (privacidade) e cabe no limite
    // (foto de celular sai com ~200-500KB em vez de 10MB+ do PNG)
    return c.toDataURL("image/jpeg", 0.85);
  }

  async function createJob() {
    if (!printer) { setErr("Escolha a impressora"); return; }
    if (!files.length) { setErr("Envie ao menos 1 arquivo"); return; }
    for (const p of perFile) if (!p.pages.length) { setErr("Selecione ao menos 1 página (ex: todas ou 1-3,5)"); return; }
    setLoading(true); setErr("");
    try {
      const ids: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        let baked: string | undefined;
        if (f.type === "image") {
          try {
            baked = await bakeImage(f);
          } catch {
            throw new Error(`${f.f.name}: não consegui ler essa foto (se for HEIC do iPhone, abra e exporte como JPG antes).`);
          }
        }
        const dataUrl = f.type === "image" ? baked : f.dataUrl;
        if (dataUrl && dataUrl.length > 1_800_000) {
          throw new Error(`${f.f.name}: PDF muito grande para envio direto (limite ~1,3 MB). Comprima em ilovepdf.com ou mande como imagem. S3 com arquivos grandes entra na próxima versão.`);
        }
        const r = await fetch("/api/jobs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printerSlug: printer.slug, fileName: f.f.name ?? "documento",
            fileType: f.type, pages: perFile[i].pages, copies, duplex: false, pagesPerSheet: f.perSheet,
            landscape: f.landscape,
            fileDataUrl: dataUrl,
            couponCode: couponApplied?.code,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Erro ao criar pedido");
        ids.push(d.job.id);
      }
      setJobIds(ids);
      setCancelled(false);
      setPixQr(""); setPixCopy(""); setPixId("");
      if (couponApplied?.singleUse) {
        try {
          const used: string[] = JSON.parse(localStorage.getItem("sp-coupons-used") ?? "[]");
          const code = couponApplied.code.toUpperCase();
          if (!used.includes(code)) {
            used.push(code);
            localStorage.setItem("sp-coupons-used", JSON.stringify(used));
          }
        } catch {}
      }
      // Total zerado (cupom 100%): pula o Pix e libera direto
      if (price.totalCents === 0) {
        try {
          for (const id of ids) {
            const r = await fetch("/api/jobs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: id }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error ?? "Erro ao liberar pedido gratuito");
          }
          finishPaid();
        } catch (e: any) { setErr(e.message); }
        finally { setLoading(false); }
        return;
      }
      setStep(4);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function mockPay() {
    // Sem token MP (dev): mantém simulação antiga
    setLoading(true); setErr("");
    try {
      for (const id of jobIds) {
        const r = await fetch("/api/jobs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: id }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Erro no pagamento");
      }
      finishPaid();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  function finishPaid() {
    const n = Number(localStorage.getItem("sp-loyalty") ?? "0") + 1;
    localStorage.setItem("sp-loyalty", String(n));
    setLoyalty(n);
    setStep(5);
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch {}
  }

  function notifyReady() {
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("SafePrint: impressão pronta! 🎉", { body: "Retire na saída da caixa." });
      }
    } catch {}
  }

  async function startPix() {
    setLoading(true); setErr(""); setPixQr(""); setPixCopy(""); setPixId("");
    try {
      const r = await fetch("/api/payments/pix", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds, payerEmail: payerEmail || undefined }),
      });
      const d = await r.json();
      if (r.status === 503) { await mockPay(); return; } // dev sem token
      if (!r.ok) throw new Error(d.error ?? "Erro ao gerar Pix");
      setPixQr(d.qrBase64 ?? ""); setPixCopy(d.copyPaste ?? ""); setPixId(String(d.paymentId));
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!pixId || step !== 4) return;
    let stop = false;
    let tries = 0;
    const t = setInterval(async () => {
      try {
        tries++;
        const r = await fetch(`/api/payments/pix?paymentId=${pixId}`);
        const d = await r.json();
        if (d.jobs?.some((j: any) => j.status === "expired" || j.status === "failed")) {
          clearInterval(t);
          if (!stop) setErr("Pedido expirou antes do pagamento. Refaça o pedido.");
          return;
        }
        if (d.status === "approved" && !stop) { clearInterval(t); finishPaid(); }
        if (tries > 75 && !stop) { clearInterval(t); setErr("Pix ainda não confirmado após 5min. Se pagou, aguarde o estorno ou fale com o operador."); }
      } catch {}
    }, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [pixId, step]);

  // Status em tempo real do pedido na etapa final (segue até concluir/falhar, ~15min)
  useEffect(() => {
    if (step !== 5 || !jobIds.length) return;
    let stop = false;
    let tries = 0;
    const check = async (): Promise<boolean> => {
      try {
        const r = await fetch(`/api/jobs/${jobIds[0]}`);
        const d = await r.json();
        if (stop || !r.ok) return false;
        const st = d.job.status;
        setLiveStatus((prev) => {
          if (prev !== "done" && st === "done") notifyReady();
          return st;
        });
        setQueueAhead(d.queueAhead ?? 0);
        return st === "done" || st === "failed" || st === "expired";
      } catch { return false; }
    };
    check().then((fin) => { if (fin) return; });
    const t = setInterval(async () => {
      tries++;
      if (tries > 220) { clearInterval(t); return; }
      if (await check()) clearInterval(t);
    }, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [step, jobIds]);

  async function sendRefund() {
    setLoading(true); setRefundOk(""); setErr("");
    try {
      const r = await fetch("/api/refunds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: jobIds[0], motive: refundMotive, description: refundDesc, name: refundName, whatsapp: refundZap, photoDataUrl: refundPhoto }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro");
      setRefundOk(d.message);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen font-sans bg-[#fafafa] dark:bg-[#0c0d0f] text-zinc-900 dark:text-zinc-100">
      {/* NAV */}
      <header className="sticky top-0 z-20 bg-[#fafafa]/90 dark:bg-[#0c0d0f]/90 backdrop-blur border-b border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="size-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
              <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 1h6l3 3v11H3V1zm5 1v3h3v9H4V2h4z" /></svg>
            </span>
            <div>
              <p className="font-semibold tracking-tight leading-none text-[16px]">SafePrint</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Impressão autoatendimento</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="text-sm rounded-lg border border-zinc-200 dark:border-white/10 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5" title="Alternar tema">{dark ? "Claro" : "Escuro"}</button>
            <a href="/" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hidden sm:block">Início</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <div className="border-b border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            {printer ? (
              <><span className="size-1.5 rounded-full bg-emerald-500 live-dot" />{printer.name}</>
            ) : "Escaneie o QR da máquina"}
          </p>
          <h1 className="font-semibold tracking-tight text-[28px] leading-[1.15] mt-2">Imprima em menos de 1 minuto.</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">Envie o PDF, pague no Pix e retire na saída da caixa.</p>
          {promo?.enabled && promo?.title && (
            <p className="mt-3 text-sm"><span className="font-semibold">{promo.title}</span>{promo.description ? <span className="text-zinc-600 dark:text-zinc-400"> — {promo.description}</span> : null}</p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            <span><b className="text-zinc-900 dark:text-zinc-100">R$ 1,50</b>/folha até 5 fls</span>
            <span><b className="text-zinc-900 dark:text-zinc-100">R$ 1,35</b>/folha 6–10 fls</span>
            <span><b className="text-zinc-900 dark:text-zinc-100">R$ 1,25</b>/folha 11+ fls</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6 space-y-5 pb-16">
        {/* STEPPER */}
        <div className="card p-4 flex items-center gap-1 overflow-x-auto">
          {STEPS.map((l, i) => {
            const n = i + 1;
            const isActive = step === n, done = step > n;
            return (
              <div key={l} className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className={`stepdot ${done ? "bg-emerald-600 text-white" : isActive ? "bg-brand-600 text-white" : "bg-zinc-100 dark:bg-white/10 text-zinc-400"}`}>{done ? "✓" : n}</span>
                <span className={`text-xs font-medium truncate ${isActive || done ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>{l}</span>
                {n < 5 && <span className="flex-1 h-px bg-zinc-200 dark:bg-white/10 mx-1" />}
              </div>
            );
          })}
        </div>

        {err && <div className="card p-4 border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm font-medium">{err}</div>}

        {showRangeHelp && (
          <div className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setShowRangeHelp(false)}>
            <div className="bg-white rounded-[2rem] p-7 max-w-sm w-full shadow-pop space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-extrabold text-lg">Como usar o intervalo?</h3>
              <div className="text-sm text-ink-600 font-medium space-y-2">
                <p>• <b>Página única:</b> <code className="bg-ink-50 px-1 rounded">5</code> imprime a página 5</p>
                <p>• <b>Intervalo:</b> <code className="bg-ink-50 px-1 rounded">1-3</code> imprime as páginas 1, 2 e 3</p>
                <p>• <b>Junte com vírgula:</b> <code className="bg-ink-50 px-1 rounded">1-3,5,8-10</code></p>
                <p>• Use <kbd>-</kbd> entre as páginas para indicar um intervalo e <kbd>,</kbd> para separar listas.</p>
              </div>
              <button onClick={() => setShowRangeHelp(false)} className="btn-primary mt-2">Entendi!</button>
            </div>
          </div>
        )}

        {showTour && (
          <div className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-5">
            <div className="bg-white rounded-[2rem] p-7 max-w-sm w-full shadow-pop text-center space-y-4">
              {tourSlide === 0 && <><p className="text-4xl">📷</p><h3 className="font-extrabold text-lg">1. Escaneie o QR</h3><p className="hint">O QR da máquina abre o site com aquela impressora já selecionada. Sem app, sem cadastro.</p></>}
              {tourSlide === 1 && <><p className="text-4xl">📄</p><h3 className="font-extrabold text-lg">2. Envie e ajuste</h3><p className="hint">Suba o PDF ou foto, escolha as páginas (as miniaturas ajudam!), cópias e veja o preço na hora.</p></>}
              {tourSlide === 2 && <><p className="text-4xl">🧾</p><h3 className="font-extrabold text-lg">3. Pague e retire</h3><p className="hint">Pix confirmado, a máquina imprime em ~30s. Pegue na saída da caixa.</p></>}
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((s) => <span key={s} className={`size-2 rounded-full transition-all ${tourSlide === s ? "bg-ink-900 w-5" : "bg-ink-200"}`} />)}
              </div>
              <button onClick={() => {
                if (tourSlide < 2) setTourSlide(tourSlide + 1);
                else { setShowTour(false); localStorage.setItem("sp-tour", "1"); }
              }} className="btn-primary">{tourSlide < 2 ? "Próximo →" : "Começar a imprimir 🚀"}</button>
              <button onClick={() => { setShowTour(false); localStorage.setItem("sp-tour", "1"); }} className="text-xs font-bold text-ink-300 underline">pular</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <section className="card p-6 space-y-4 text-center">
            <div className="mx-auto size-14 rounded-2xl bg-ink-900 text-white flex items-center justify-center text-2xl shadow-card">📷</div>
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">Escaneie o QR Code da impressora</h2>
              <p className="hint">Aponte a câmera do celular para o QR colado na caixa. No notebook, digite o código de 6 dígitos colado nela.</p>
            </div>
            <div className="rounded-3xl bg-ink-50 border border-ink-100 p-4 space-y-2.5 text-left">
              <p className="label">Insira o código da impressora</p>
              <div className="flex gap-2">
                <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="012345" className="input font-mono text-center tracking-[0.3em]" />
                <button onClick={() => {
                  const found = printers.find((p) => p.code === codeInput.trim());
                  if (found) { setCodeErr(""); setSlug(found.slug); setStep(2); }
                  else setCodeErr("Código inválido. Confira os 6 dígitos colados na máquina.");
                }} className="bg-ink-900 text-white text-sm font-bold px-5 rounded-2xl whitespace-nowrap">Usar código</button>
              </div>
              {codeErr && <p className="text-sm font-bold text-red-500">{codeErr}</p>}
            </div>
            {offlineMsg && <p className="rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold p-3">{offlineMsg}</p>}
            {!printers.length && <p className="hint">Carregando…</p>}
          </section>
        )}

        {step >= 2 && printer && (
          <div className="card px-4 py-3 flex items-center justify-between">
            <p className="text-[13px]"><span className="text-ink-400 font-medium">Imprimindo em</span> <b>{printer.name}</b> <span className="text-ink-400">• {printer.location}</span></p>
            <span className="chip bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">🔒 via QR</span>
          </div>
        )}

        {step === 2 && (
          <section className="card p-6 space-y-4">
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">Envie os arquivos</h2>
              <p className="hint">PDF, JPG ou PNG • até 5 arquivos • apagados após imprimir (LGPD)</p>
            </div>
            <label className="block rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition">
              <input type="file" accept=".pdf,image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && handleFiles(e.target.files)} />
              <div className="mx-auto size-14 rounded-2xl bg-ink-900 text-white flex items-center justify-center text-2xl shadow-card">⇪</div>
              <p className="mt-3 font-extrabold text-[15px]">Toque para escolher até 5 arquivos</p>
              <p className="hint">Trabalho da faculdade, currículo, boleto…</p>
            </label>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["🔒", "Privado"], ["⚡", "~30 segundos"], ["🧾", "Pix na hora"]].map(([i, t]) => (
                <div key={t} className="rounded-2xl bg-ink-50 border border-ink-100 py-2.5 text-xs font-bold text-ink-600">{i} {t}</div>
              ))}
            </div>
            <p className="hint text-center">🔐 Metadados/EXIF das fotos são removidos antes do envio.</p>
          </section>
        )}

        {step === 3 && activeFile && (
          <section className="card p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-lg tracking-tight">Ajustes de impressão</h2>
                <p className="hint">📄 {activeFile.f.name} • {activeFile.totalPages} pág(s) • somente frente</p>
              </div>
              <span className="chip bg-ink-900 text-white shrink-0">{activeFile.perSheet} pág/folha</span>
            </div>

            {files.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {files.map((f, i) => (
                  <button key={i} onClick={() => setActive(i)} className={`chip border-2 px-3 py-1.5 whitespace-nowrap ${active === i ? "border-ink-900 bg-ink-900 text-white" : "border-ink-100 bg-white text-ink-500"}`}>
                    {f.type === "pdf" ? "📄" : "🖼️"} {f.f.name.length > 14 ? f.f.name.slice(0, 14) + "…" : f.f.name}
                  </button>
                ))}
              </div>
            )}

            {activeFile.type === "pdf" && (
              <div className="space-y-2">
                <p className="label">Quais páginas imprimir?</p>
                <select value={pageMode} onChange={(e) => setPageMode(e.target.value as any)} className="input">
                  <option value="all">Imprimir todas as páginas</option>
                  <option value="even">Imprimir somente páginas pares</option>
                  <option value="odd">Imprimir somente páginas ímpares</option>
                  <option value="custom">Intervalo personalizado</option>
                </select>
                <div className="flex gap-2 items-center">
                  <input value={range} onChange={(e) => setRange(e.target.value)} disabled={pageMode !== "custom"} className="input font-mono disabled:opacity-40 disabled:bg-ink-50" placeholder='Ex: 1-3,5,8-10' />
                  <button onClick={() => setShowRangeHelp(true)} title="Como usar o intervalo?" className="size-11 rounded-full border border-ink-200 bg-white text-ink-500 font-extrabold text-sm shrink-0">?</button>
                </div>
                <p className="hint">{perFile[active]?.pages.length ? <>✅ {perFile[active].pages.length} pág(s): {perFile[active].pages.slice(0, 10).join(", ")}{perFile[active].pages.length > 10 ? "…" : ""}</> : "Digite um intervalo, ex: 1-3,5,8-10"}</p>
                <button onClick={() => updateActive({ landscape: !activeFile.landscape })} className={`chip border-2 px-3 py-1.5 cursor-pointer ${activeFile.landscape ? "border-ink-900 bg-ink-900 text-white" : "border-ink-100 bg-white text-ink-500"}`}>📐 {activeFile.landscape ? "Paisagem" : "Retrato"}</button>
              </div>
            )}

            {activeFile.type === "pdf" && (
              <div>
                <p className="label mb-2">🔍 Pré-visualização</p>
                <div className="rounded-3xl bg-ink-900 p-4 flex flex-col items-center gap-3 shadow-card">
                  <div className="relative bg-white rounded-xl shadow-pop overflow-hidden" style={activeFile.landscape ? { width: "100%", maxWidth: 320, aspectRatio: "4 / 3" } : { width: "100%", maxWidth: 240, aspectRatio: "3 / 4" }}>
                    {(() => {
                      const selPages = perFile[active]?.pages ?? [];
                      const idx = Math.min(pdfView, Math.max(0, selPages.length - 1));
                      const pageNum = selPages[idx];
                      return viewThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={viewThumb} alt={`pág ${pageNum}`} className="absolute inset-0 w-full h-full object-contain transition-all duration-300" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-ink-300 text-xs font-bold">sem prévia</div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPdfView(Math.max(0, pdfView - 1))} disabled={pdfView <= 0} className="size-10 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 disabled:opacity-30">‹</button>
                    <span className="text-white text-xs font-bold">{(perFile[active]?.pages ?? []).length ? `pág. ${Math.min(pdfView + 1, (perFile[active]?.pages ?? []).length)} de ${(perFile[active]?.pages ?? []).length}` : "—"}</span>
                    <button onClick={() => setPdfView(Math.min(Math.max(0, (perFile[active]?.pages.length ?? 1) - 1), pdfView + 1))} disabled={pdfView >= Math.max(0, (perFile[active]?.pages.length ?? 1) - 1)} className="size-10 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 disabled:opacity-30">›</button>
                  </div>
                  <p className="text-[10px] text-white/40 font-medium">* só a página atual é renderizada na prévia</p>
                </div>
              </div>
            )}

            <div>
              <p className="label mb-2">Páginas por folha</p>
              <div className="flex gap-2 flex-wrap">
                {(activeFile.type === "pdf" ? [1, 2, 4, 6, 9] : [1, 2, 4]).map((n) => (
                  <button key={n} onClick={() => updateActive({ perSheet: n })} className={`chip border-2 px-3.5 py-2 cursor-pointer ${activeFile.perSheet === n ? "border-ink-900 bg-ink-900 text-white" : "border-ink-100 bg-white text-ink-500"}`}>{n === 1 ? "1 (normal)" : `${n} por folha`}</button>
                ))}
              </div>
            </div>

            {activeFile.type === "image" && (
            <div>
              <p className="label mb-2">🖼️ Arraste e ajuste na folha A4</p>
              <div className="flex gap-4 items-start">
                <div
                  ref={previewRef}
                  className={`relative bg-white rounded-xl overflow-hidden border border-ink-200 shadow-card shrink-0 ${activeFile.type === "image" && activeFile.perSheet === 1 ? "cursor-grab active:cursor-grabbing touch-none" : ""}`}
                  style={{ width: 168, height: 238 }}
                  onPointerDown={(e) => {
                    if (activeFile.type !== "image" || activeFile.perSheet !== 1) return;
                    draggingRef.current = true;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!draggingRef.current || !previewRef.current) return;
                    const r = previewRef.current.getBoundingClientRect();
                    updateActive({
                      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
                      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
                    });
                  }}
                  onPointerUp={() => { draggingRef.current = false; }}
                >
                  {activeFile.type === "image" ? (
                    activeFile.perSheet === 1 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={activeFile.dataUrl} alt="preview" draggable={false} style={{ position: "absolute", left: `${activeFile.x}%`, top: `${activeFile.y}%`, width: `${activeFile.scale}%`, transform: `translate(-50%,-50%) rotate(${activeFile.rotate}deg)` }} />
                    ) : (
                      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: activeFile.perSheet <= 2 ? "1fr" : "1fr 1fr", gridTemplateRows: activeFile.perSheet <= 2 ? `repeat(${activeFile.perSheet},1fr)` : `repeat(${Math.ceil(activeFile.perSheet / 2)},1fr)` }}>
                        {Array.from({ length: activeFile.perSheet }).map((_, i) => (
                          <div key={i} className="border border-ink-100 flex items-center justify-center p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={activeFile.dataUrl} alt="" className="max-w-full max-h-full object-contain" />
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: activeFile.perSheet === 1 ? "1fr" : activeFile.perSheet <= 2 ? "1fr" : "1fr 1fr", gridTemplateRows: activeFile.perSheet === 1 ? "1fr" : activeFile.perSheet <= 2 ? `repeat(${activeFile.perSheet},1fr)` : `repeat(${Math.ceil(activeFile.perSheet / 2)},1fr)` }}>
                      {Array.from({ length: activeFile.perSheet }).map((_, i) => (
                        <div key={i} className="border border-ink-100 bg-ink-50/40 flex flex-col items-center justify-center gap-0.5">
                          <span className="text-sm">📄</span>
                          <span className="text-[9px] font-bold text-ink-400">pág. {perFile[active]?.pages[i] ?? i + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  {activeFile.type === "image" && activeFile.perSheet === 1 && (
                    <>
                      <div><p className="label">Tamanho — {activeFile.scale}%</p><input type="range" min={10} max={100} value={activeFile.scale} onChange={(e) => updateActive({ scale: Number(e.target.value) })} className="w-full accent-ink-900" /></div>
                      <button onClick={() => updateActive({ rotate: (activeFile.rotate + 90) % 360 })} className="chip border-2 border-ink-100 bg-white text-ink-600 px-3.5 py-2 font-bold">🔄 Rotacionar {activeFile.rotate}°</button>
                      <p className="label">Posições rápidas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          ["↖️", 20, 20], ["⬆️", 50, 15], ["↗️", 80, 20],
                          ["⬅️", 15, 50], ["⬛", 50, 50], ["➡️", 85, 50],
                          ["↙️", 20, 80], ["⬇️", 50, 85], ["↘️", 80, 80],
                        ] as [string, number, number][]).map(([emo, px, py]) => (
                          <button key={emo} onClick={() => updateActive({ x: px, y: py })} className="size-8 rounded-xl border border-ink-200 bg-white hover:border-ink-900 text-xs">{emo}</button>
                        ))}
                      </div>
                      <button onClick={() => updateActive({ x: 50, y: 50, scale: 100 })} className="text-xs font-extrabold text-brand-600 underline">📐 Ajustar à folha inteira</button>
                    </>
                  )}
                  {activeFile.type === "image" && activeFile.perSheet > 1 && (
                    <p className="hint">Com várias por folha, a imagem é centralizada automaticamente em cada célula.</p>
                  )}
                </div>
              </div>
            </div>
            )}

            <div>
              <p className="label mb-2">Quantas cópias?</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setCopies(Math.max(1, copies - 1))} className="size-11 rounded-2xl border border-ink-200 font-extrabold text-lg hover:border-ink-900">−</button>
                <span className="text-2xl font-extrabold w-10 text-center">{copies}</span>
                <button onClick={() => setCopies(Math.min(100, copies + 1))} className="size-11 rounded-2xl bg-ink-900 text-white font-extrabold text-lg">+</button>
                <span className="hint ml-1">máx. 100 — limitado também pelo papel da máquina</span>
              </div>
            </div>

            <div>
              <p className="label mb-2">🎟️ Cupom de desconto</p>
              <div className="flex gap-2">
                <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="CÓDIGO" className="input font-mono uppercase" />
                {couponApplied ? (
                  <button onClick={() => { setCouponApplied(null); setCouponInput(""); }} className="text-xs font-extrabold text-red-400 whitespace-nowrap">remover</button>
                ) : (
                  <button onClick={() => {
                    const code = couponInput.trim().toUpperCase();
                    const c = coupons.find((x) => x.code.toUpperCase() === code);
                    if (!c) { setErr("Cupom inválido"); return; }
                    if (c.singleUse) {
                      try {
                        const used: string[] = JSON.parse(localStorage.getItem("sp-coupons-used") ?? "[]");
                        if (used.includes(code)) { setErr("Cupom de uso único já usado neste aparelho."); return; }
                      } catch {}
                    }
                    setCouponApplied(c);
                  }} className="bg-ink-900 text-white text-sm font-bold px-5 rounded-2xl">Aplicar</button>
                )}
              </div>
              {couponApplied && <p className="hint text-emerald-600 font-bold mt-1">✅ {couponApplied.code} aplicado: -{couponApplied.percentOff}%</p>}
            </div>

            <div className="rounded-3xl bg-ink-900 text-white p-5 shadow-card">
              <div className="flex justify-between text-sm font-medium text-white/70">
                <span>{files.length} arquivo(s) • {totalSheets} folha(s)</span>
                <span>{brl(price.unitCents)}/folha</span>
              </div>
              <p className="text-[11px] text-white/50 mt-1">1–5 fls R$1,50 • 6–10 fls R$1,35 • 11+ fls R$1,25 • somente frente</p>
              <p className="font-display font-extrabold text-[26px] mt-1">Total {brl(price.totalCents)}</p>
              <label className="flex items-start gap-2.5 mt-3 text-left cursor-pointer">
                <input type="checkbox" checked={lgpdOk} onChange={(e) => { setLgpdOk(e.target.checked); localStorage.setItem("sp-lgpd", e.target.checked ? "1" : "0"); }} className="size-4 mt-0.5 accent-white" />
                <span className="text-[11px] text-white/70 font-medium">Li e aceito a <a href="/privacidade" target="_blank" className="underline font-bold text-white">política de privacidade (LGPD)</a> sobre o tratamento dos meus arquivos.</span>
              </label>
              <button disabled={loading || !lgpdOk} onClick={createJob} className="mt-3 w-full bg-white text-ink-900 font-extrabold rounded-2xl py-3.5 hover:bg-brand-50 disabled:opacity-50">
                {loading ? "Gerando pedido…" : lgpdOk ? "Continuar para pagamento →" : "Aceite a LGPD para continuar"}
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="card p-6 space-y-4 text-center">
            <h2 className="font-extrabold text-lg tracking-tight">Pagamento via Pix</h2>
            <p className="font-display font-extrabold text-3xl">{brl(price.totalCents)}</p>
            <p className="hint">{totalSheets} folha(s) × {brl(price.unitCents)} • {printer?.name} • {jobIds.length} pedido(s)</p>
            {!pixQr ? (
              <>
                <input value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} inputMode="email" placeholder="Seu e-mail (pro comprovante Pix)" className="input text-center" />
                <button disabled={loading} onClick={startPix} className="btn-primary">{loading ? "Gerando Pix…" : "Gerar Pix →"}</button>
                <p className="hint">Pix via Mercado Pago • confirma sozinho em segundos</p>
              </>
            ) : (
              <>
                {pixQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`data:image/png;base64,${pixQr}`} alt="QR Pix" className="mx-auto size-48 rounded-3xl border border-ink-100 shadow-card" />
                ) : null}
                {pixCopy && (
                  <button onClick={() => navigator.clipboard?.writeText(pixCopy)} className="chip border-2 border-ink-200 bg-white px-4 py-2 font-mono text-[11px] break-all max-w-full">📋 Copiar código Pix</button>
                )}
                <p className="hint">Pagou? Aguarde, liberamos sozinho…{process.env.NODE_ENV !== "production" && <> (ou <button onClick={mockPay} className="underline font-bold">simular em dev</button>)</>}</p>
              </>
            )}
          </section>
        )}

        {step === 5 && (
          <section className="card p-6 space-y-4 text-center border-emerald-200">
            {!cancelled && (
              <>
                {liveStatus === "done" ? (
                  <div className="rounded-3xl bg-emerald-500 text-white p-6 shadow-pop animate-pulse">
                    <p className="text-4xl">🎉</p>
                    <h2 className="font-display font-extrabold tracking-tight text-2xl mt-2">Sua impressão ficou pronta!</h2>
                    <p className="font-bold text-white/90 text-sm mt-1">Retire na saída da caixa 📤</p>
                  </div>
                ) : liveStatus === "failed" ? (
                  <div className="rounded-3xl bg-red-50 border-2 border-red-200 p-6">
                    <p className="text-4xl">⚠️</p>
                    <h2 className="font-extrabold text-lg tracking-tight text-red-700 mt-2">Algo deu errado na impressão</h2>
                    <p className="hint">O estorno do Pix é automático. Se não voltar em minutos, peça análise abaixo.</p>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto size-14 rounded-full bg-brand-500 text-white flex items-center justify-center text-2xl font-extrabold">{queueAhead + 1}º</div>
                    <div>
                      <h2 className="font-extrabold text-lg tracking-tight">{queueAhead > 0 ? `Sua impressão é a ${queueAhead + 1}ª da fila` : "Sua impressão é a próxima!"}</h2>
                      <p className="hint">Pedido <code className="font-mono bg-ink-50 px-1.5 py-0.5 rounded">{jobIds[0]?.slice(0, 8)}</code> • {totalSheets} folha(s) • {liveStatus === "printing" ? "imprimindo agora…" : "aguarde na saída da caixa"}</p>
                    </div>
                  </>
                )}

                <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4 text-left text-sm space-y-1">
                  <p className="font-extrabold text-xs text-ink-400 tracking-widest">COMPROVANTE</p>
                  <div className="flex justify-between font-medium"><span>Protocolo</span><code className="font-mono font-bold">{jobIds[0]?.slice(0, 8)}</code></div>
                  <div className="flex justify-between font-medium"><span>Máquina</span><b>{printer?.name}</b></div>
                  <div className="flex justify-between font-medium"><span>Folhas × valor</span><span>{totalSheets} × {brl(price.unitCents)}</span></div>
                  <div className="flex justify-between font-extrabold text-base"><span>Total pago</span><span>{brl(price.totalCents)}</span></div>
                  <div className="flex justify-between font-medium"><span>Status</span><b>{liveStatus === "printing" ? "🖨️ Imprimindo…" : liveStatus === "done" ? "✅ Concluído" : liveStatus === "failed" ? "❌ Falhou (estorno automático)" : queueAhead > 0 ? `⏳ Na fila (${queueAhead} na frente)` : "⏳ Na fila"}</b></div>
                  <button onClick={() => window.print()} className="text-xs font-bold text-brand-600 underline mt-1">🖨️ Salvar/imprimir comprovante</button>
                </div>

                {confirmedOk && (
                  <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-5">
                    <p className="font-extrabold text-emerald-700">Valeu! 🎓</p>
                    <p className="text-sm text-emerald-600 font-medium mt-1">Impressão confirmada e pagamento recebido. Volte sempre!</p>
                  </div>
                )}
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
                        <p className="hint">Pedido <code className="font-mono bg-ink-50 px-1.5 py-0.5 rounded">{jobIds[0]?.slice(0, 8)}</code> • respondemos no seu WhatsApp</p>
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
                          const r = new FileReader();
                          r.onload = () => {
                            // remove EXIF passando por canvas
                            const img = new Image();
                            img.onload = () => {
                              const c = document.createElement("canvas");
                              c.width = img.width; c.height = img.height;
                              c.getContext("2d")!.drawImage(img, 0, 0);
                              setRefundPhoto(c.toDataURL("image/jpeg", 0.9));
                            };
                            img.src = String(r.result);
                          };
                          r.readAsDataURL(f);
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
              </>
            )}
            <button onClick={() => { setStep(1); setFiles([]); setJobIds([]); setPixQr(""); setPixCopy(""); setPixId(""); setPayerEmail(""); setLiveStatus(""); setQueueAhead(0); setOfflineMsg(""); setRange("todas"); setCopies(1); setCouponApplied(null); setCouponInput(""); setRefundPhoto(""); setRefundOk(""); setRefundMotive(""); setRefundDesc(""); setRefundName(""); setRefundZap(""); setShowRefund(false); setConfirmedOk(false); setCancelled(false); }} className="text-xs font-bold text-ink-300 underline">Nova impressão</button>
          </section>
        )}

        <footer className="text-center hint pb-6">
          SafePrint • A4 • P&B laser • Arquivos excluídos em 24h • <a href="/privacidade" className="underline">Privacidade (LGPD)</a>
        </footer>
      </div>
    </main>
  );
}
