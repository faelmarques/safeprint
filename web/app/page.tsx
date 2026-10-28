"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { LogoMark } from "@/components/Logo";
import { IconPin } from "@/components/Icons";
import { brl, calcTotal } from "@/lib/pricing";
import { DEFAULT_TIERS, type PriceTier, type Printer } from "@/lib/printers";

type Promo = { enabled: boolean; title: string; description: string };
type Site = { siteName: string; tagline: string; footerNote: string };

const STEPS = [
  { t: "Escaneie o QR da máquina", d: "O QR colado na caixa abre o site já com aquela impressora selecionada. No computador, digite o código de 6 dígitos que está ao lado do QR." },
  { t: "Envie o arquivo", d: "PDF, JPG ou PNG, até 5 arquivos por pedido. Escolha as páginas, o número de cópias e quantas páginas por folha. O valor aparece na hora." },
  { t: "Pague no Pix", d: "Informe seu WhatsApp, gere o Pix e pague. A liberação é automática assim que o pagamento é confirmado." },
  { t: "Retire na saída da caixa", d: "O site mostra sua posição na fila e avisa quando as folhas estiverem prontas." },
];

const FAQS = [
  { q: "Preciso criar conta ou instalar aplicativo?", a: "Não. Tudo roda no navegador do celular. A única informação pedida é o seu WhatsApp, na hora do pagamento: usamos para avisar sobre o pedido e para falar com você caso precise de reembolso. Sem senha, sem cadastro." },
  { q: "Que tipo de impressão é feita?", a: "Preto e branco, laser, papel A4, somente frente. Você pode colocar 2, 4, 6 ou 9 páginas por folha para gastar menos." },
  { q: "E se a impressão sair com defeito ou não sair?", a: "Se a máquina registrar falha, o Pix é estornado automaticamente. Para outros problemas (folhas faltando, impressão borrada), abra a solicitação no fim do pedido com uma foto e respondemos pelo WhatsApp." },
  { q: "O que acontece com o meu arquivo?", a: "Ele é enviado criptografado, fica guardado só até a impressão e é apagado em seguida, com prazo máximo de 24 horas. Fotos têm os metadados (EXIF) removidos antes do envio." },
  { q: "A máquina está sem papel ou offline. E agora?", a: "O site não aceita novos pedidos para máquinas offline ou sem papel suficiente, então você não paga por algo que não vai sair." },
];

function rangeLabel(t: PriceTier, next?: PriceTier) {
  if (next) return next.minSheets - 1 === t.minSheets ? `${t.minSheets} folha${t.minSheets > 1 ? "s" : ""}` : `${t.minSheets} a ${next.minSheets - 1} folhas`;
  return `${t.minSheets} ou mais folhas`;
}

export default function Landing() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [site, setSite] = useState<Site>({ siteName: "SafePrint", tagline: "Impressão autoatendimento", footerNote: "Arquivos excluídos em até 24h" });

  useEffect(() => {
    fetch("/api/printers")
      .then((r) => r.json())
      .then((d) => {
        setPrinters(d.printers ?? []);
        setPromo(d.promo ?? null);
        if (d.site) setSite((s) => ({ ...s, ...d.site }));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoaded(true));
  }, []);

  const online = printers.filter((p) => p.status === "online").length;
  const tiers = useMemo(() => {
    const t = printers[0]?.tiers?.length ? printers[0].tiers : DEFAULT_TIERS;
    return [...t].sort((a, b) => a.minSheets - b.minSheets);
  }, [printers]);

  const example = calcTotal(12, tiers);

  return (
    <main className="min-h-screen">
      <SiteHeader nav name={site.siteName} />

      {promo?.enabled && promo.title && (
        <div className="bg-brand-600 text-white">
          <p className="mx-auto max-w-5xl px-5 py-2 text-sm">
            <span className="font-semibold">{promo.title}</span>
            {promo.description ? <span className="text-white/85">. {promo.description}</span> : null}
          </p>
        </div>
      )}

      {/* HERO */}
      <section className="mx-auto max-w-5xl px-5 pt-12 pb-16 md:pt-20 md:pb-24 grid md:grid-cols-[1.15fr_1fr] gap-12 items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-sm text-ink-600">
            <span className={`size-2 rounded-full ${online > 0 ? "bg-emerald-500 live-dot" : "bg-ink-300"}`} />
            {!loaded ? "Verificando máquinas" : online > 0 ? `${online} máquina${online > 1 ? "s" : ""} disponível${online > 1 ? "is" : ""} agora, em Franca/SP` : "Nenhuma máquina disponível no momento"}
          </p>
          <h1 className="font-semibold tracking-tight text-[40px] md:text-[52px] leading-[1.06] mt-5 text-balance">
            Imprima pelo celular. Retire na máquina.
          </h1>
          <p className="text-ink-600 text-[17px] leading-relaxed mt-5 max-w-lg">
            Escaneie o QR da impressora, envie o arquivo, pague no Pix e pegue as folhas na saída da caixa. Sem aplicativo e sem senha.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <a href="/imprimir" className="bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg px-6 py-3 transition-colors">Imprimir agora</a>
            <a href="#precos" className="btn-ghost !py-3 !px-6 !text-[15px]">Ver preços</a>
          </div>
          <p className="text-sm text-ink-500 mt-6">P&amp;B laser · A4 · somente frente · a partir de {brl(tiers[tiers.length - 1].pricePerSheetCents)} a folha</p>
        </div>

        {/* Comprovante de exemplo: o recibo do Pix e a folha que sai da máquina são o mesmo objeto. */}
        <div className="receipt-wrap mx-auto w-full max-w-[340px] md:ml-auto" role="img" aria-label="Exemplo de comprovante de um pedido de 12 folhas">
          <div className="receipt px-6 pt-6 pb-7 text-[13px] text-ink-800">
            <div className="flex items-center gap-2.5">
              <LogoMark size={22} />
              <span className="font-sans font-semibold text-[15px] text-ink-900">SafePrint</span>
            </div>
            <p className="mt-4 text-ink-500">Exemplo de pedido</p>
            <div className="dash my-3" />
            <dl className="space-y-1.5">
              <Row k="Máquina" v={printers[0]?.name ?? "UniFACEF, Bloco A"} />
              <Row k="Arquivo" v="trabalho-final.pdf" />
              <Row k="Páginas" v="12" />
              <Row k="Cópias" v="1" />
              <Row k="Folhas" v={`12 × ${brl(example.unitCents)}`} />
            </dl>
            <div className="dash my-3" />
            <div className="flex items-baseline justify-between">
              <span className="text-ink-600">Total</span>
              <span className="text-[22px] font-medium text-ink-900">{brl(example.totalCents)}</span>
            </div>
            <div className="dash my-3" />
            <div className="flex items-center justify-between text-ink-500">
              <span>Pix confirmado</span>
              <span className="text-emerald-600 font-medium">pago</span>
            </div>
            <div className="flex items-center justify-between text-ink-500 mt-1">
              <span>Na fila</span>
              <span>próxima</span>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como" className="border-t border-ink-100 scroll-mt-14">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-20 grid md:grid-cols-[1fr_1.6fr] gap-10">
          <div>
            <h2 className="font-semibold tracking-tight text-[28px] leading-tight">Do celular ao papel em quatro passos</h2>
            <p className="text-ink-600 mt-3 max-w-xs">Leva cerca de um minuto, contando o Pix.</p>
          </div>
          <ol className="divide-y divide-ink-100 border-y border-ink-100">
            {STEPS.map((s, i) => (
              <li key={s.t} className="py-5 grid grid-cols-[2rem_1fr] gap-3">
                <span className="mono text-sm text-ink-400 pt-0.5">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.t}</p>
                  <p className="text-sm text-ink-600 mt-1 leading-relaxed max-w-lg">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="border-t border-ink-100 bg-surface scroll-mt-14">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-20 grid md:grid-cols-[1fr_1.6fr] gap-10">
          <div>
            <h2 className="font-semibold tracking-tight text-[28px] leading-tight">Quanto mais folhas, menor o preço por folha</h2>
            <p className="text-ink-600 mt-3 max-w-xs">O valor é por folha de papel, não por página. Com 2 páginas por folha, o pedido sai mais barato.</p>
          </div>
          <div>
            <table className="w-full text-[15px]">
              <caption className="sr-only">Preço por folha conforme a quantidade</caption>
              <thead>
                <tr className="text-left text-sm text-ink-500">
                  <th scope="col" className="font-normal pb-2">Quantidade no pedido</th>
                  <th scope="col" className="font-normal pb-2 text-right">Por folha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 border-y border-ink-100">
                {tiers.map((t, i) => (
                  <tr key={t.minSheets}>
                    <td className="py-4">{rangeLabel(t, tiers[i + 1])}</td>
                    <td className="py-4 text-right mono text-lg font-medium">{brl(t.pricePerSheetCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-ink-500 mt-4">Preto e branco, laser, A4, somente frente. Cupons de desconto são aplicados na etapa de ajustes.</p>
          </div>
        </div>
      </section>

      {/* MÁQUINAS */}
      <section id="maquinas" className="border-t border-ink-100 scroll-mt-14">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-20 grid md:grid-cols-[1fr_1.6fr] gap-10">
          <div>
            <h2 className="font-semibold tracking-tight text-[28px] leading-tight">Onde encontrar</h2>
            <p className="text-ink-600 mt-3 max-w-xs">Cada máquina tem um QR e um código de 6 dígitos colados na caixa.</p>
          </div>
          <ul className="divide-y divide-ink-100 border-y border-ink-100">
            {!loaded && [0, 1].map((i) => (
              <li key={i} className="py-5"><div className="h-4 w-48 rounded bg-ink-100" /><div className="h-3 w-72 max-w-full rounded bg-ink-100 mt-3" /></li>
            ))}
            {loaded && failed && <li className="py-5 text-sm text-ink-600">Não foi possível carregar as máquinas agora. Atualize a página em instantes.</li>}
            {loaded && !failed && !printers.length && <li className="py-5 text-sm text-ink-600">Nenhuma máquina cadastrada ainda.</li>}
            {printers.map((p) => (
              <li key={p.id} className="py-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-ink-600 mt-0.5">{p.location}</p>
                  {p.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline mt-2"
                    >
                      <IconPin size={14} />{p.address}
                    </a>
                  )}
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium ${p.status === "online" ? "text-emerald-700 dark:text-emerald-400" : "text-ink-500"}`}>
                  <span className={`size-1.5 rounded-full ${p.status === "online" ? "bg-emerald-500" : "bg-ink-300"}`} />
                  {p.status === "online" ? "Disponível" : p.status === "maintenance" ? "Em pausa" : "Offline"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* DÚVIDAS */}
      <section id="duvidas" className="border-t border-ink-100 bg-surface scroll-mt-14">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-20 grid md:grid-cols-[1fr_1.6fr] gap-10">
          <h2 className="font-semibold tracking-tight text-[28px] leading-tight">Perguntas frequentes</h2>
          <div className="divide-y divide-ink-100 border-y border-ink-100">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="font-medium text-[15px] cursor-pointer list-none flex justify-between items-center gap-4">
                  {f.q}
                  <span className="text-ink-400 text-xl leading-none shrink-0 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="text-sm text-ink-600 mt-2 leading-relaxed pr-8 max-w-xl">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100">
        <div className="mx-auto max-w-5xl px-5 py-8 flex flex-col md:flex-row gap-2 md:items-center md:justify-between text-sm text-ink-500">
          <p><span className="font-medium text-ink-800">{site.siteName}</span> · {site.tagline}</p>
          <p>{site.footerNote} · <a href="/privacidade" className="underline hover:text-ink-900">Política de privacidade</a></p>
        </div>
      </footer>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right text-ink-900 break-all">{v}</dd>
    </div>
  );
}
