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

  return (
    <main className="min-h-screen font-sans bg-[#fafafa] dark:bg-[#0c0d0f] text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold tracking-tight text-[17px] leading-none">{site.siteName}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{site.tagline}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="text-sm rounded-lg border border-zinc-200 dark:border-white/10 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5" title="Alternar tema">{dark ? "Claro" : "Escuro"}</button>
            <a href="/imprimir" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg px-4 py-2">Imprimir</a>
          </div>
        </div>
      </header>

      {promo?.enabled && promo?.title && (
        <div className="border-b border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5">
          <p className="mx-auto max-w-3xl px-5 py-2.5 text-sm">
            <span className="font-semibold">{promo.title}</span>{promo.description ? <span className="text-zinc-600 dark:text-zinc-400"> — {promo.description}</span> : null}
          </p>
        </div>
      )}

      <section className="mx-auto max-w-3xl px-5 pt-14 pb-12">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{site.heroBadge}</p>
        <h1 className="font-semibold tracking-tight text-4xl md:text-5xl leading-[1.1] mt-3 max-w-xl">{site.heroTitle}</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-4 max-w-xl leading-relaxed">{site.heroSub}</p>
        <div className="flex flex-wrap items-center gap-3 mt-7">
          <a href="/imprimir" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-lg px-6 py-3">Começar a imprimir</a>
          <a href="#como" className="rounded-lg px-6 py-3 border border-zinc-300 dark:border-white/15 font-medium hover:bg-zinc-100 dark:hover:bg-white/5">Como funciona</a>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-5">A partir de R$ 1,25 por folha · Pagamento via Pix · Pronto em cerca de 1 minuto</p>
      </section>

      <section id="como" className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="font-semibold tracking-tight text-2xl">Como funciona</h2>
          <ol className="mt-6 divide-y divide-zinc-200 dark:divide-white/10 border-y border-zinc-200 dark:border-white/10">
            {[
              ["Escaneie o QR", "O QR da caixa abre o site com aquela impressora selecionada. Na tela do computador, digite o código de 6 dígitos colado nela."],
              ["Envie e ajuste", "Suba o PDF ou foto, escolha as páginas (ex: 1–3,5) e as cópias. O preço aparece na hora."],
              ["Pague e retire", "Pix confirmado, a máquina imprime em segundos. Retire na saída da caixa."],
            ].map(([t, d], i) => (
              <li key={t} className="py-5 flex gap-4">
                <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500 w-6 shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="precos" className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="font-semibold tracking-tight text-2xl">Preços</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Papel A4 · P&B · 1 página por folha · pagamento via Pix</p>
          <div className="mt-6 border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
            {[
              ["Até 5 folhas", "R$ 1,50 /folha"],
              ["6 a 10 folhas", "R$ 1,35 /folha"],
              ["Acima de 10 folhas", "R$ 1,25 /folha"],
            ].map(([t, v], i) => (
              <div key={t} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-zinc-200 dark:border-white/10" : ""}`}>
                <p className="text-sm">{t}</p>
                <p className="font-semibold text-sm">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="onde" className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="font-semibold tracking-tight text-2xl">Onde encontrar</h2>
          <div className="mt-6 space-y-3">
            {printers.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{p.location}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${p.status === "online" ? "border-emerald-600/30 text-emerald-700 dark:text-emerald-400" : "border-zinc-300 dark:border-white/15 text-zinc-500 dark:text-zinc-400"}`}>
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

      <section id="duvidas" className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="font-semibold tracking-tight text-2xl">Dúvidas frequentes</h2>
          <div className="mt-6 divide-y divide-zinc-200 dark:divide-white/10 border-y border-zinc-200 dark:border-white/10">
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
        <div className="mx-auto max-w-3xl px-5 py-8 flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          <p><span className="font-medium text-zinc-700 dark:text-zinc-300">{site.siteName}</span> · {site.tagline}</p>
          <p className="text-xs">{site.footerNote} · <a href="/privacidade" className="underline">Privacidade</a></p>
        </div>
      </footer>
    </main>
  );
}
