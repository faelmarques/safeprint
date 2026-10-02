# SafePrint — Impressão autoatendimento

Monorepo profissional para escalar a nível nacional: 1 QR por impressora.

## Estrutura
- `web/` — site Next.js 14 + Tailwind (fluxo cliente + painel operador + APIs)
- `pi-agent/` — script Python que roda no Raspberry Pi dentro da caixa (polling + CUPS)
- `web/data/` — JSON local do MVP (jobs, papel, reembolsos). Produção: trocar por Postgres.

## Fluxo
1. Usuário escaneia QR `https://seu-dominio/?p=unifacef-bloco-a-x7k2` → impressora pré-selecionada
2. Upload PDF/imagem → escolhe páginas (`todas`, `1-3,5`), cópias, duplex → imagem arrasta/redimensiona na folha A4
3. Preço: até 5 fls R$1,50 • 6–10 fls R$1,35 • 11+ fls R$1,25 (editável em `/admin` → Preços & promoções)
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

## Deixando a máquina rodando 24h (notebook antigo / Pi / Linux)
**Tampa fechada:** edite `/etc/systemd/logind.conf` com `HandleLidSwitch=ignore`, e reinicie com `sudo systemctl restart systemd-logind`.

**Atualizações sem parar produção:** desative em `/etc/apt/apt.conf.d/20auto-upgrades` — rode update manual 1x por mês.

**Voltar após queda de energia:** no BIOS (F2/F12/Del), habilite `Power on AC attach` → **Yes/Enabled** / `Restore on AC Power Loss` → **Power On**.

**Subir site e agent automaticamente:** use serviços systemd com `Restart=always` (exemplo em `docs/safeprint.service`).

**Nobreak recomendado** se a energia do local for instável.
