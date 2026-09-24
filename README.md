# SafePrint — Impressão autoatendimento

Monorepo profissional para escalar a nível nacional: 1 QR por impressora.

## Estrutura
- `web/` — site Next.js 14 + Tailwind (fluxo cliente + painel operador + APIs)
- `pi-agent/` — script Python que roda no Raspberry Pi dentro da caixa (polling + CUPS)
- `web/data/` — JSON local do MVP (jobs, papel, reembolsos). Produção: trocar por Postgres.

## Fluxo
1. Usuário escaneia QR `https://seu-dominio/?p=unifacef-bloco-a-x7k2` → impressora pré-selecionada
2. Upload PDF/imagem → escolhe páginas (`todas`, `1-3,5`), cópias, duplex → imagem arrasta/redimensiona na folha A4
3. Preço: 1–4 fls R$1,35 • 5–9 fls R$1,25 • 10+ fls R$1,15 (editável em `web/lib/printers.ts`)
4. Paga Pix (MVP simulado, produção: Mercado Pago) → job `queued`
5. Pi dá `GET /api/pi/next?printerSlug=...`, imprime via `lp`, dá `POST` confirmando → desconta papel
6. Papel ≤ 50 → alerta Telegram (configure `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`)
7. "Não saiu/falhado" → envia foto → você analisa em `/admin` e reembolsa Pix manual

## Rodar local
```bash
cd web
npm install
npm run dev
# http://localhost:3000/?p=unifacef-bloco-a-x7k2
# http://localhost:3000/admin
```

## Pi (caixa Unifacef)
```bash
sudo apt install cups python3-pip
sudo usermod -aG lpadmin pi
# adiciona a Brother no CUPS: http://IP-DO-PI:631
pip install -r pi-agent/requirements.txt
PRINTER_SLUG=unifacef-bloco-a-x7k2 API_BASE=https://seu-dominio CUPS_PRINTER=Brother python pi-agent/agent.py
```

## Produção (escala nacional)
- Deploy `web/` na Vercel/Railway
- Trocar `lib/store.ts` por Prisma + Postgres (schema pronto: Printer, PrintJob, RefundRequest, PaperLog)
- Uploads: S3/R2 privado com expiração 24h (LGPD)
- Pagamento: webhook Mercado Pago → `PUT /api/jobs` vira automático
- 1 impressora nova = 1 linha em Printer + QR impresso e colado na caixa
