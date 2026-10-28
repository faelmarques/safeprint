# Auditoria técnica e decisões de produto (out/2026)

Escopo: revisão de `web/` (UI, APIs de pedido, Pix, Pi) feita a partir do código do repositório.
Não executei o projeto (sem `node_modules`/rede no ambiente de revisão): rode `npm run build` antes do deploy.

## Decisão: cadastro?

**Sem conta e sem senha. Identificação leve por WhatsApp no checkout.**

- Cadastro completo derrubaria a conversão (o usuário está de pé, na frente da máquina, com pressa).
- Só o QR deixava três buracos: não havia como avisar o cliente, o reembolso já exigia WhatsApp (então o dado já era coletado, só que tarde demais), e não havia vínculo pedido → pessoa para disputa ou abuso.
- Implementado: campo único de WhatsApp (máscara + validação no cliente e no servidor), lembrado no aparelho (`localStorage`), gravado em `PrintJob.customerPhone`, visível só no `/admin` (coluna "WhatsApp" com link `wa.me`), pré-preenchido no formulário de reembolso, citado na política de privacidade. A API pública de status do pedido **não** devolve o número.

### Próximas fases (não implementadas)

1. Verificação por OTP (WhatsApp/SMS) **apenas** ao pedir reembolso manual, não em toda impressão. Exige provedor (Twilio, Zenvia, API oficial do WhatsApp).
2. Aviso ativo "sua impressão ficou pronta" por WhatsApp (hoje é só notificação do navegador).
3. Página "Meus pedidos" por número + OTP, para reimpressão.

## Achados de segurança e robustez

| Prioridade | Achado | Estado |
|---|---|---|
| Alta | `PUT /api/jobs` liberava pedido pago sem Pix quando `MERCADOPAGO_ACCESS_TOKEN` não estava definido. O front chama isso automaticamente quando o Pix responde 503, então token ausente/expirado em produção = impressão grátis. | **Corrigido**: em produção, sem token, só libera pedido de total R$ 0 (cupom 100%). |
| Alta | Persistência em arquivos JSON (`store.ts`), incluindo arquivos em base64 de até ~2 MB dentro de `jobs.json`. Escritas concorrentes podem corromper o arquivo; o arquivo cresce sem limite. | Pendente: migrar para Postgres e arquivos para S3/R2 privado (já previsto no README). |
| Média | `rateLimit` usa o primeiro IP de `x-forwarded-for`. Se o proxy não sobrescrever esse header, o cliente o forja e foge do limite. Também é por processo (memória). | Pendente: confiar só no header do seu proxy/CDN; Redis/Upstash se houver mais de uma instância. |
| Média | Cupom de uso único também é checado em `localStorage` (cosmético); a checagem real é no servidor, o que está correto. | Ok, apenas informativo. |
| Baixa | `verifyWebhookSignature` retorna `null` sem `MP_WEBHOOK_SECRET` e o webhook segue. Não permite fraude porque o status é reconsultado na API do Mercado Pago, mas defina o segredo em produção. Comparação de HMAC não usa `timingSafeEqual`. | Pendente (simples). |
| Baixa | Contagem de páginas do PDF no servidor é heurística (`/Count`). | Aceitável no MVP. |

Pontos que já estavam bons: arquivos cifrados em repouso (AES-256), validação de tipo/conteúdo de upload, claim anti-duplicidade do Pi, estorno automático em falha, sessões de admin com TOTP opcional, cabeçalhos de segurança no `next.config.mjs`.

## Redesign

- **Identidade**: um objeto só: o comprovante. O papel que sai da máquina e o recibo do Pix são o mesmo objeto, então ele aparece na landing (hero) com borda serrilhada e números em mono. O resto fica silencioso.
- **Tipografia**: IBM Plex Sans (interface) + IBM Plex Mono (valores, códigos, protocolo).
- **Cor**: azul da marca (`#1d63eb`) mantido; neutros frios via variáveis CSS (`--ink-*`, `--surface`, `--canvas`) que trocam no modo escuro, substituindo ~25 regras `!important` antigas.
- **Landing**: preços lidos da API (antes estavam fixos no HTML e podiam divergir do `/admin`), tabela de preços em vez de três cards, passos numerados (é uma sequência real), lista de máquinas com link para o mapa, estados de carregamento/erro, FAQ atualizado.
- **Fluxo `/imprimir`**: emojis trocados por ícones de traço, tour de boas-vindas removido (a landing e as etapas já explicam), etapas com semântica (`ol`, `aria-current`), campos com `label`, erros com `role="alert"`, resumo do pedido em formato de recibo, passo do Pix refeito.
- **Acessibilidade**: foco visível, `prefers-reduced-motion`, tema sem "flash" no carregamento.
- **Admin**: migrado para os mesmos tokens (cabeçalho escuro fixo), sem emojis.

## Como validar

```bash
cd web && npm install && npm run build && npm run dev
```
Conferir em tema claro e escuro: `/`, `/imprimir?p=<slug>`, `/admin`, `/privacidade`. Fluxo completo com Pix real em modo de teste do Mercado Pago.
