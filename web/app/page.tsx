"use client";

import { useEffect, useState } from "react";
import type { Printer } from "@/lib/printers";
import { brl } from "@/lib/pricing";

const FAQS = [
  {
    q: "Como funciona?",
    a: "Você escaneia o QR da máquina, envia o PDF ou foto, escolhe páginas e cópias, paga no Pix e retira na saída da caixa em ~30 segundos.",
  },
  {
    q: "Quanto custa?",
    a: "R$ 1,50 por folha (até 5 fls), R$ 1,35 (6 a 10 fls) e R$ 1,25 (acima de 10 fls). Papel A4, impressão P&B a laser, 1 página por folha.",
  },
  {
    q: "Preciso instalar algo?",
    a: "Não. Tudo roda no navegador do celular: sem app, sem cadastro, sem fila.",
  },
  {
    q: "E se a impressão sair com defeito?",
    a: "No final do pedido tem o botão “Não saiu / saiu falhado”. Você tira uma foto, a gente analisa e devolve o valor via Pix.",
  },
  {
    q: "Meus arquivos ficam salvos?",
    a: "Não. Os arquivos são apagados após a impressão (LGPD).",
  },
];

export default function Landing() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [promo, setPromo] = useState<{ enabled: boolean; title: string; description: string } | null>(null);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const d = localStorage.getItem("sp-dark") === "1";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    fetch("/api/printers").then((r) => r.json()).then((d) => { setPrinters(d.printers ?? []); setPromo(d.promo ?? null); }).catch(() => {});
  }, []);

  function toggleDark() {
    const d = !dark;
    setDark(d);
    localStorage.setItem("sp-dark", d ? "1" : "0");
    document.documentElement.classList.toggle("dark", d);
  }

  return (
    <main className="min-h-screen font-sans text-ink-900 bg-white">
      {/* NAV */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-ink-100">
        <div className="mx-auto max-w-5xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-2xl bg-gradient-to-br from-brand-500 to-ink-900 flex items-center justify-center text-white text-lg shadow-pop">⎙</div>
            <div>
              <p className="font-extrabold tracking-tight leading-none text-[17px]">SafePrint</p>
              <p className="text-[11px] text-ink-400 font-medium">Impressão autoatendimento</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-bold text-ink-500">
            <a href="#como" className="hover:text-ink-900">Como funciona</a>
            <a href="#precos" className="hover:text-ink-900">Preços</a>
            <a href="#onde" className="hover:text-ink-900">Onde encontrar</a>
            <a href="#duvidas" className="hover:text-ink-900">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="border border-ink-200 text-sm font-extrabold rounded-2xl px-3.5 py-2.5 bg-white" title="Modo escuro">{dark ? "☀️" : "🌙"}</button>
            <a href="/imprimir" className="bg-ink-900 hover:bg-ink-800 text-white text-sm font-extrabold rounded-2xl px-5 py-2.5 shadow-card">Imprimir agora</a>
          </div>
        </div>
      </header>

      {/* PROMO BANNER */}
      {promo?.enabled && promo?.title && (
        <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 text-ink-900">
          <p className="mx-auto max-w-5xl px-5 py-2.5 text-center text-sm font-extrabold">
            🎉 {promo.title}{promo.description ? ` — ${promo.description}` : ""}
          </p>
        </div>
      )}

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-900 to-brand-800" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-5 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center text-white">
          <div>
            <p className="chip bg-white/10 text-brand-100 border border-white/15 mb-4">🎓 Novo no Unifacef • Franca/SP</p>
            <h1 className="font-display font-extrabold tracking-tight text-[34px] md:text-[44px] leading-[1.05]">
              Imprima seu trabalho <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-emerald-300">sem fila</span>, sem papelaria.
            </h1>
            <p className="text-white/70 font-medium mt-4 text-[15px] leading-relaxed">
              Chegou na faculdade, lembrou do trabalho? Escaneie o QR da máquina,
              envie o PDF pelo celular, pague no Pix e retire na hora. Pronto em menos de 1 minuto.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <a href="/imprimir" className="bg-white text-ink-900 font-extrabold rounded-2xl px-7 py-3.5 text-[15px] shadow-card hover:bg-brand-50">Começar a imprimir →</a>
              <a href="#como" className="border border-white/25 text-white font-bold rounded-2xl px-7 py-3.5 text-[15px] hover:bg-white/10">Ver como funciona</a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-[13px] font-bold text-white/80">
              <span>⚡ ~30 segundos</span><span>🧾 Pix na hora</span><span>🔒 Arquivo apagado após imprimir</span>
            </div>
          </div>
          {/* mock do celular */}
          <div className="hidden md:flex justify-center">
            <div className="w-[280px] rounded-[2rem] bg-white text-ink-900 p-5 shadow-pop rotate-2">
              <p className="chip bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">📍 UniFACEF — Bloco A</p>
              <p className="font-extrabold text-sm">Trabalho_final.pdf</p>
              <p className="text-xs text-ink-400 font-medium">8 páginas • 1 cópia • frente</p>
              <div className="rounded-2xl bg-ink-50 border border-ink-100 p-3 mt-3 text-xs font-bold space-y-1">
                <div className="flex justify-between"><span>Páginas 1–8</span><span>8 folhas</span></div>
                <div className="flex justify-between text-ink-400"><span>Unitário</span><span>R$ 1,35</span></div>
                <div className="flex justify-between text-base font-extrabold"><span>Total</span><span>R$ 10,80</span></div>
              </div>
              <div className="mt-3 rounded-2xl bg-ink-900 text-white text-center font-extrabold text-sm py-3">Pagar com Pix</div>
              <p className="text-center text-[11px] text-ink-300 font-bold mt-2">✓ Na fila! Retire na máquina</p>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-5xl px-5 -mt-0 py-8 grid grid-cols-3 gap-3">
        {[
          ["< 1 min", "do QR ao papel"],
          ["R$ 1,25", "a partir de 11 folhas"],
          ["24h*", "máquina no campus"],
        ].map(([v, l]) => (
          <div key={l} className="card p-4 text-center">
            <p className="font-display font-extrabold text-xl md:text-2xl tracking-tight">{v}</p>
            <p className="text-xs text-ink-400 font-medium">{l}</p>
          </div>
        ))}
      </section>

      {/* BENEFÍCIOS */}
      <section className="mx-auto max-w-5xl px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["📱", "Sem app", "Tudo no navegador do celular"],
          ["💸", "Pix na hora", "Confirmação automática"],
          ["🔒", "Privacidade LGPD", "Arquivo apagado em 24h"],
          ["⚡", "~30 segundos", "Do QR ao papel na mão"],
        ].map(([i, t, d]) => (
          <div key={t} className="card p-4">
            <p className="text-2xl">{i}</p>
            <p className="font-extrabold text-sm mt-1.5">{t}</p>
            <p className="text-xs text-ink-400 font-medium">{d}</p>
          </div>
        ))}
      </section>

      {/* COMO FUNCIONA */}
      <section id="como" className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-xs font-extrabold tracking-widest text-brand-600">COMO FUNCIONA</p>
        <h2 className="font-display font-extrabold tracking-tight text-2xl md:text-3xl mt-1">Três toques e o papel sai.</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {[
            ["1", "📷", "Escaneie o QR", "O QR da caixa já abre o site com aquela impressora selecionada. Sem app, sem cadastro."],
            ["2", "📄", "Envie e ajuste", "Suba o PDF ou foto, escolha as páginas (ex: 1–3,5), cópias e veja o preço na hora."],
            ["3", "🧾", "Pague e retire", "Pix confirmado, a máquina imprime em ~30s. Pegue na saída da caixa."],
          ].map(([n, icon, t, d]) => (
            <div key={t} className="card p-6 relative overflow-hidden">
              <span className="absolute top-4 right-5 font-display font-extrabold text-5xl text-ink-50">{n}</span>
              <div className="size-12 rounded-2xl bg-gradient-to-br from-brand-500 to-ink-900 text-white flex items-center justify-center text-2xl shadow-pop">{icon}</div>
              <p className="font-extrabold mt-4">{t}</p>
              <p className="text-sm text-ink-500 font-medium mt-1 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="bg-ink-50/60 border-y border-ink-100">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <p className="text-xs font-extrabold tracking-widest text-brand-600">PREÇOS</p>
          <h2 className="font-display font-extrabold tracking-tight text-2xl md:text-3xl mt-1">Quanto mais imprime, menos paga.</h2>
          <p className="text-sm text-ink-500 font-medium mt-2">Papel A4 • P&B a laser • 1 página por folha • pagamento via Pix</p>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[
              ["Até 5 folhas", "R$ 1,50", "/folha", "Pra aquela impressão rápida antes da aula.", false],
              ["6 a 10 folhas", "R$ 1,35", "/folha", "Trabalhos e listas maiores.", false],
              ["Acima de 10", "R$ 1,25", "/folha", "TCC, apostilas e volumes. O melhor valor.", true],
            ].map(([t, v, u, d, hot]) => (
              <div key={t as string} className={`rounded-3xl p-6 border-2 ${hot ? "bg-ink-900 text-white border-ink-900 shadow-pop relative" : "card"}`}>
                {hot && <span className="chip bg-emerald-400 text-ink-900 absolute -top-3 left-6">★ MAIS ESCOLHIDO</span>}
                <p className={`font-bold text-sm ${hot ? "text-white/70" : "text-ink-400"}`}>{t}</p>
                <p className="font-display font-extrabold text-4xl mt-1">{v}<span className={`text-sm font-bold ${hot ? "text-white/60" : "text-ink-300"}`}>{u}</span></p>
                <p className={`text-sm font-medium mt-2 ${hot ? "text-white/70" : "text-ink-500"}`}>{d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <a href="/imprimir" className="inline-block bg-ink-900 text-white font-extrabold rounded-2xl px-8 py-3.5 shadow-card hover:bg-ink-800">Calcular meu pedido →</a>
          </div>
        </div>
      </section>

      {/* ONDE */}
      <section id="onde" className="mx-auto max-w-5xl px-5 py-12">
        <p className="text-xs font-extrabold tracking-widest text-brand-600">ONDE ENCONTRAR</p>
        <h2 className="font-display font-extrabold tracking-tight text-2xl md:text-3xl mt-1">Máquinas perto de você.</h2>
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {printers.map((p) => (
            <div key={p.id} className="card p-5 hover:border-brand-300 hover:shadow-pop transition block">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold">{p.name}</p>
                  <p className="text-xs text-ink-400 font-medium">{p.location}</p>
                </div>
                <span className={`chip ${p.status === "online" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                  {p.status === "online" ? "● disponível" : "● offline"}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-sm font-extrabold text-ink-400">📷 Escaneie o QR colado na máquina para imprimir</span>
                {p.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`} target="_blank" className="text-xs font-bold text-ink-400 underline">📍 Ver no mapa</a>}
              </div>
            </div>
          ))}
          {!printers.length && <p className="text-sm text-ink-400 font-medium">Carregando máquinas…</p>}
        </div>
      </section>

      {/* FAQ */}
      <section id="duvidas" className="mx-auto max-w-5xl px-5 pb-12">
        <p className="text-xs font-extrabold tracking-widest text-brand-600">DÚVIDAS</p>
        <h2 className="font-display font-extrabold tracking-tight text-2xl md:text-3xl mt-1">Perguntas frequentes.</h2>
        <div className="space-y-2.5 mt-6">
          {FAQS.map((f) => (
            <details key={f.q} className="card px-5 py-4 group">
              <summary className="font-bold text-[15px] cursor-pointer list-none flex justify-between items-center">
                {f.q}<span className="text-ink-300 group-open:rotate-45 transition text-xl leading-none">+</span>
              </summary>
              <p className="text-sm text-ink-500 font-medium mt-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink-900 to-brand-700 text-white p-8 md:p-12 text-center shadow-pop">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 size-72 rounded-full bg-brand-400/30 blur-3xl" />
          <p className="relative font-display font-extrabold tracking-tight text-2xl md:text-3xl">Precisando imprimir agora?</p>
          <p className="relative text-white/70 font-medium text-sm mt-2">Leva menos de 1 minuto do celular até o papel.</p>
          <a href="/imprimir" className="relative inline-block mt-5 bg-white text-ink-900 font-extrabold rounded-2xl px-8 py-3.5 hover:bg-brand-50">Imprimir agora →</a>
        </div>
      </section>

      <footer className="border-t border-ink-100">
        <div className="mx-auto max-w-5xl px-5 py-8 flex flex-col md:flex-row gap-3 items-center justify-between text-xs text-ink-400 font-medium">
          <p><b className="text-ink-700">SafePrint</b> • Impressão autoatendimento • Franca/SP</p>
          <p>*Horário conforme o local da máquina • Arquivos excluídos em 24h • <a href="/privacidade" className="underline">Privacidade</a></p>
        </div>
      </footer>
    </main>
  );
}
