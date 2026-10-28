# AI HANDOFF - SafePrint

> Última atualização: 27/10/2026  
> Sessão: Opencode (Big Pickle)  
> Repositório: https://github.com/faelmarques/safeprint

## Objetivo atual
Adaptar os arquivos alterados que vieram na pasta `safeprint-arquivos-alterados` para esse repositório e deixar o frontend rodando localmente para visualização das mudanças.

## Estado atual
- [x] Clonado o repositório `faelmarques/safeprint` para `C:\Users\27140\Documents\safeprint`
- [x] Extraído `safeprint-arquivos-alterados.zip` de `C:\Users\27140\Downloads\`
- [x] Copiados todos os arquivos alterados sobre o repositório
- [x] Commit e push realizados para `origin/main`
- [x] Dependências instaladas em `web/`
- [x] Servidor Next.js rodando em background (`http://localhost:3000`)
- [x] Frontend aberto no navegador para visualização

**Commit feito:** `Atualiza SafePrint com arquivos alterados (nova UI, ajustes admin/jobs)`

## Arquivos principais alterados/adicionados
| Arquivo/Pasta | Observação |
|---|---|
| `web/app/page.tsx` | Nova landing page (novo layout, recibo de exemplo, seções revisadas) |
| `web/app/imprimir/page.tsx` | Tela de impressão revisada |
| `web/app/admin/page.tsx` | Painel admin atualizado |
| `web/app/api/jobs/route.ts` | Ajustes na rota de jobs |
| `web/app/layout.tsx` | Layout global atualizado |
| `web/app/globals.css` | Novos estilos/variáveis |
| `web/app/privacidade/page.tsx` | Pequenos ajustes |
| `web/components/SiteHeader.tsx` | **Novo** - Header reutilizável |
| `web/components/Logo.tsx` | **Novo** - Logotipo |
| `web/components/Icons.tsx` | **Novo** - Ícones SVG |
| `web/components/ThemeToggle.tsx` | **Novo** - Alternador de tema |
| `web/lib/store.ts` | Ajustes no store JSON |
| `web/tailwind.config.ts` | Ajustes de tema/config |
| `docs/AUDITORIA.md` | **Novo** - Auditoria do projeto |

## Como rodar em outro PC (em casa)
1. Clonar/Puxar o repo
```bash
git clone https://github.com/faelmarques/safeprint.git
# ou
git pull origin main
```

2. Instalar dependências e rodar o web
```bash
cd web
npm install
npm run dev
```

3. Acessar
- Landing: http://localhost:3000
- Impressão: http://localhost:3000/imprimir
- Admin: http://localhost:3000/admin
- Exemplo com impressora: http://localhost:3000/?p=unifacef-bloco-a-x7k2

## Contexto para próxima IA
Estamos no meio da migração/atualização visual do SafePrint. A versão nova vinda dos arquivos alterados já foi aplicada. 

**Foco agora:** visualizar/testar a nova UI, ver se tudo compila certinho e entender o que mudou em relação à versão anterior. Caso precise revisar algo, comparar com o histórico do git (`git log -p -1` ou ver diff entre commits).

## Próximos passos sugeridos
- [ ] Testar o fluxo completo: `/imprimir` com upload de arquivo
- [ ] Conferir painel `/admin` com dados mock
- [ ] Verificar se não quebrou rotas de API (`/api/printers`, `/api/jobs`, etc)
- [ ] Ajustar o que parecer fora do padrão

## Plano para escalar e deixar "top"
### Fase 1: Pronto pra produção (Alta prioridade)
- [ ] **Migrar JSON pra banco** - Trocar `web/lib/store.ts` (JSON) por Prisma + Postgres (Neon/Supabase/Railway). Começar testando SQLite local e migrar depois.
- [ ] **Mercado Pago real** - Implementar preferência no MP, QR dinâmico e webhook `POST /api/webhooks/mercadopago` com validação + idempotência. Trocar fluxo "simulado" por real.
- [ ] **Expirar jobs pendentes** - Criar lógica/cron pra expirar `pending` com >10-15 min. Evita fila travada com PIX não pago.
- [ ] **Uploads mais seguros** - Validar MIME/extensão, remover EXIF de imagens, limitar tamanho, migrar pra R2/S3 com URL assinada + expiração 24h.

### Fase 2: Estabilizar os Pis (Alta prioridade)
- [ ] **Heartbeat das máquinas** - Criar `POST /api/pi/heartbeat` e fazer `pi-agent` enviar a cada 30s. Salvar `lastSeenAt` em `Printer` e exibir status online/offline no `/admin` e na landing.
- [ ] **Agent mais resiliente** - Retry com backoff, timeout, logs, tratamento de erro do `lp`, reconexão automática.
- [ ] **Lock por impressora** - Garantir apenas 1 job `printing` por `printerSlug` para evitar impressão simultânea.
- [ ] **Status no painel** - Card "Status das caixas" com "Último contato há X min" no `/admin`.

### Fase 3: UX, Admin e Escala (Média prioridade)
- [ ] **Gerador de QR por impressora** - Criar `/admin/printers/[slug]/qr` gerando PNG + SVG (pronto pra colar na caixa).
- [ ] **Dashboard com métricas** - Cards "Impresso hoje", "Faturado hoje", "Pendentes", "Reembolsos", filtros por impressora/data.
- [ ] **Melhorar tela `/imprimir`** - Pré-visualização maior, indicador de páginas válidas, aviso pra arquivos grandes, feedback melhor no checkout.
- [ ] **Healthcheck** - `GET /api/health` com status do banco + uptime.
- [ ] **`.env.example`** - Criar `web/.env.example` com todas as variáveis necessárias.

**Recomendação imediata:** Começar por **Heartbeat + status online/offline** (Fase 2). É rápido, resolve um ponto crítico e casa perfeitamente com a proposta "1 QR por impressora". Depois seguir com **Gerador de QR** e **Expiração de jobs pendentes**.

## Dica pra retomar
Na próxima sessão no outro PC, cole isso pro opencode:

```text
Lê o arquivo docs/AI_HANDOFF.md e continua exatamente de onde a gente parou.
Estamos testando a nova UI do SafePrint que acabamos de aplicar a partir dos arquivos alterados.
```

Assim ele já pega todo o contexto sem precisar recontar a conversa.