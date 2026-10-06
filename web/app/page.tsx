"use client";

import { useEffect, useState } from "react";
import type { Printer } from "@/lib/printers";

const FAQS = [
  {
    q: "Como funciona?",
    a: "Escaneie o QR da máquina, envie o PDF ou foto, escolha páginas e cópias, pague no Pix e retire na saída da caixa.",
  },
  {
    q: "Quanto custa?",
    a: "R$ 1,50 por folha (até 5 fls), R$ 1,35 (6 a 10 fls) e R$ 1,25 (acima de 10 fls). Papel A4, impressão P&B.",
  },
  {
    q: "Preciso instalar algo?",
    a: "Não. Tudo funciona no navegador do celular: sem aplicativo e sem cadastro.",
  },
  {
    q: "E se a impressão sair com defeito?",
    a: "No final do pedido há a opção de reportar o problema com foto. Analisamos e devolvemos o valor via Pix.",
  },
  {
    q: "Meus arquivos ficam salvos?",
    a: "Não. Os arquivos são apagados após a impressão.",
  },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  qr: "M1 1h4v4H1V1zm1 1v2h2V2H2zm8-1h4v4h-4V1zm1 1v2h2V2h-2zM1 9h4v4H1V9zm1 1v2h2v-2H2zm8-1h1V8H9v1h1zm-4 0h1V8H5v1h1zm4 1h1V9H9v1h1zM5 9h1v1H5V9zm3 0h1v1H8V9zm-3 3h1v1H5v-1zm8-3h3v3h-3V9zm1 1v1h1v-1h-1zM9 12h3v3H9v-3zm1 1v1h1v-1h-1z",
  doc: "M3 1h6l3 3v11H3V1zm5 1v3h3v9H4V2h4z",
  zap: "M8.5 1 2 9h4l-1 6 6.5-8h-4l1-6z",
};

export default function Landing() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [promo, setPromo] = useState<{ enabled: boolean; title: string; description: string } | null>(null);
  const [site, setSite] = useState({ siteName: "SafePrint", tagline: "Impressão autoatendimento", heroBadge: "Novo no Unifacef — Franca/SP", heroTitle: "Imprima seu trabalho sem fila, sem papelaria.", heroSub: "Escaneie o QR da máquina, envie o PDF pelo celular, pague no Pix e retire na hora.", footerNote: "Arquivos excluídos em 24h" });
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const d = localStorage.getItem("sp-dark") === "1";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    fetch("/api/printers").then((r) => r.json()).then((d) => { setPrinters(d.printers ?? []); setPromo(d.promo ?? null); if (d.site) setSite((s) => ({ ...s, ...d.site })); }).catch(() => {});
  }, []);

  function toggleDark() {
    const d = !dark;
    setDark(d);
    localStorage.setItem("sp-dark", d ? "1" : "0");
    document.documentElement.classList.toggle("dark", d);
  }

  const online = printers.filter((p) => p.status === "online").length;

  return (
    <main className="min-h-screen font-sans bg-[#fafafa] dark:bg-[#0c0d0f] text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-white/10 bg-[#fafafa]/90 dark:bg-[#0c0d0f]/90 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="size-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
              <Icon d={ICONS.doc} />
            </span>
            <div>
              <p className="font-semibold tracking-tight text-[16px] leading-none">{site.siteName}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{site.tagline}</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
            <a href="#como" className="hover:text-zinc-900 dark:hover:text-zinc-100">Como funciona</a>
            <a href="#precos" className="hover:text-zinc-900 dark:hover:text-zinc-100">Preços</a>
            <a href="#onde" className="hover:text-zinc-900 dark:hover:text-zinc-100">Onde encontrar</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="text-sm rounded-lg border border-zinc-200 dark:border-white/10 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5" title="Alternar tema">{dark ? "Claro" : "Escuro"}</button>
            <a href="/imprimir" className="bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg px-4 py-2">Imprimir</a>
          </div>
        </div>
      </header>

      {promo?.enabled && promo?.title && (
        <div className="border-b border-brand-600/20 bg-brand-50 dark:bg-brand-500/10">
          <p className="mx-auto max-w-5xl px-5 py-2.5 text-sm text-brand-800 dark:text-brand-200">
            <span className="font-semibold">{promo.title}</span>{promo.description ? <span> — {promo.description}</span> : null}
          </p>
        </div>
      )}

      {/* HERO */}
      <section className="mx-auto max-w-5xl px-5 pt-14 pb-14 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="rise inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 rounded-full px-3 py-1.5">
            <span className="size-2 rounded-full bg-emerald-500 live-dot" />
            {online > 0 ? `${online} máquina${online > 1 ? "s" : ""} disponível${online > 1 ? "eis" : ""} agora` : site.heroBadge}
          </p>
          <h1 className="rise rise-1 font-semibold tracking-tight text-4xl md:text-[44px] leading-[1.08] mt-4">{site.heroTitle}</h1>
          <p className="rise rise-2 text-zinc-600 dark:text-zinc-400 mt-4 leading-relaxed max-w-md">{site.heroSub}</p>
          <div className="rise rise-3 flex flex-wrap items-center gap-3 mt-7">
            <a href="/imprimir" className="bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg px-6 py-3">Começar a imprimir</a>
            <a href="#como" className="rounded-lg px-6 py-3 border border-zinc-300 dark:border-white/15 font-medium hover:border-zinc-400 dark:hover:border-white/25">Como funciona</a>
          </div>
          <div className="rise rise-4 flex gap-6 mt-8 text-sm">
            {[["< 1 min", "do QR ao papel"], ["R$ 1,25", "a partir de 11 fls"], ["Pix", "confirmação automática"]].map(([v, l]) => (
              <div key={l}>
                <p className="font-semibold text-lg">{v}</p>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* visual do produto */}
        <div className="rise rise-2 hidden md:block">
          <div className="mx-auto w-[290px] rounded-[2rem] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#141518] shadow-[0_24px_60px_-24px_rgba(0,0,0,.25)] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">UniFACEF — Bloco A</p>
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 live-dot" /> online
              </span>
            </div>
            <div className="mt-4 rounded-xl border border-zinc-200 dark:border-white/10 p-4">
              <div className="flex gap-1.5">
                {["w-3/4", "w-1/2", "w-2/3"].map((w, i) => (
                  <div key={i} className={`h-2 rounded bg-zinc-200 dark:bg-white/10 ${w}`} />
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {["w-full", "w-11/12", "w-full", "w-4/5", "w-full"].map((w, i) => (
                  <div key={i} className={`h-1.5 rounded bg-zinc-100 dark:bg-white/5 ${w}`} />
                ))}
              </div>
              <div className="mt-4 mx-auto size-24 rounded-lg bg-zinc-900 dark:bg-white p-1.5 grid grid-cols-5 grid-rows-5 gap-px">
                {Array.from({ length: 25 }).map((_, i) => (
                  <span key={i} className={i % 4 === 0 || i % 7 === 3 ? "bg-white dark:bg-zinc-900 rounded-[1px]" : "bg-zinc-900 dark:bg-white rounded-[1px]"} />
                ))}
              </div>
              <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">QR da máquina</p>
            </div>
            <div className="mt-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-center text-sm font-medium py-3">Pagar R$ 10,80 no Pix</div>
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-2.5 flex items-center justify-center gap-1.5">
              <span className="size-1.5 rounded-full bg-brand-500 live-dot" /> Na fila — retire na máquina
            </p>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como" className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Como funciona</p>
          <h2 className="font-semibold tracking-tight text-2xl md:text-3xl mt-2">Do celular ao papel em três passos</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {[
              [ICONS.qr, "Escaneie o QR", "O QR da caixa abre o site com aquela impressora selecionada. No computador, digite o código de 6 dígitos colado nela."],
              [ICONS.doc, "Envie e ajuste", "Suba o PDF ou foto, escolha as páginas (ex: 1–3,5) e as cópias. O preço aparece na hora."],
              [ICONS.zap, "Pague e retire", "Pix confirmado, a máquina imprime em segundos. O site avisa quando estiver pronta."],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="card p-6 hover:border-brand-600/30 transition-colors">
                <span className="size-10 rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Icon d={icon as string} />
                </span>
                <p className="font-semibold mt-4">{t}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="border-t border-zinc-200 dark:border-white/10 bg-zinc-50/60 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Preços</p>
          <h2 className="font-semibold tracking-tight text-2xl md:text-3xl mt-2">Quanto mais imprime, menos paga</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {[
              ["Até 5 folhas", "R$ 1,50", "por folha", "Para aquela impressão rápida antes da aula.", false],
              ["6 a 10 folhas", "R$ 1,35", "por folha", "Trabalhos e listas maiores.", false],
              ["Acima de 10", "R$ 1,25", "por folha", "TCCs e apostilas. O melhor valor.", true],
            ].map(([t, v, u, d, hot]) => (
              <div key={t as string} className={`rounded-2xl p-6 border ${hot ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100" : "card"}`}>
                {hot && <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-300 dark:text-brand-600 mb-2">Mais escolhido</p>}
                <p className={`text-sm ${hot ? "text-white/60 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}>{t}</p>
                <p className="font-semibold text-4xl mt-1 tracking-tight">{v}<span className={`text-sm font-normal ${hot ? "text-white/50 dark:text-zinc-500" : "text-zinc-400"}`}> {u}</span></p>
                <p className={`text-sm mt-2 ${hot ? "text-white/70 dark:text-zinc-600" : "text-zinc-600 dark:text-zinc-400"}`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ONDE */}
      <section id="onde" className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Onde encontrar</p>
          <h2 className="font-semibold tracking-tight text-2xl md:text-3xl mt-2">Máquinas perto de você</h2>
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            {printers.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{p.location}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-md border flex items-center gap-1.5 shrink-0 ${p.status === "online" ? "border-emerald-600/30 text-emerald-700 dark:text-emerald-400" : "border-zinc-300 dark:border-white/15 text-zinc-500 dark:text-zinc-400"}`}>
                    <span className={`size-1.5 rounded-full ${p.status === "online" ? "bg-emerald-500 live-dot" : "bg-zinc-400"}`} />
                    {p.status === "online" ? "Disponível" : "Indisponível"}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">Escaneie o QR colado na máquina para imprimir aqui.</p>
              </div>
            ))}
            {!printers.length && <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando máquinas…</p>}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14 grid md:grid-cols-[1fr_2fr] gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Dúvidas</p>
            <h2 className="font-semibold tracking-tight text-2xl md:text-3xl mt-2">Perguntas frequentes</h2>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-white/10 border-y border-zinc-200 dark:border-white/10">
            {FAQS.map((f) => (
              <details key={f.q} className="py-4 group">
                <summary className="font-medium text-[15px] cursor-pointer list-none flex justify-between items-center gap-4">
                  {f.q}<span className="text-zinc-400 group-open:rotate-45 transition text-lg leading-none shrink-0">+</span>
                </summary>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed pr-8">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-8 flex flex-col md:flex-row gap-1 md:items-center md:justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <p><span className="font-medium text-zinc-700 dark:text-zinc-300">{site.siteName}</span> · {site.tagline}</p>
          <p className="text-xs">{site.footerNote} · <a href="/privacidade" className="underline">Privacidade</a></p>
        </div>
      </footer>
    </main>
  );
}
