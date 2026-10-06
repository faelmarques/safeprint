# SafePrint — Recuperação e lançamento

## Backup
- Automático: `./web/scripts/backup.sh` antes de todo deploy + cron diário:
  `0 3 * * * /root/safeprint/web/scripts/backup.sh`
- Guarda em `/root/backups/safeprint/` (14 últimos). Copie o `.env` e
  `FILE_ENC_KEY` para um cofre à parte — **sem a chave, os arquivos
  cifrados não voltam**.

## Rollback de deploy
```bash
cd /root/safeprint && git tag  # ache a tag anterior
git checkout <tag> -- web && cd web && npm run build
pm2 restart safeprint --update-env
```

## Restore de dados
```bash
systemctl stop safeprint  # ou pm2 stop safeprint
tar -xzf /root/backups/safeprint/data-<STAMP>.tar.gz -C /root/safeprint/web
pm2 start safeprint
```

## Segredos (VPS, `.env` com chmod 600)
- `ADMIN_PASSWORD` (só bootstrap; troque no painel → vira hash)
- `MERCADOPAGO_ACCESS_TOKEN` (server-side, nunca no front)
- `MP_WEBHOOK_SECRET` (assinatura do webhook)
- `PI_API_KEY` (agent ↔ API)
- `FILE_ENC_KEY` (`openssl rand -hex 32`; **rotacionar invalida arquivos antigos**)
- `TELEGRAM_*` (alertas)

## Endurecimento aplicado
- HTTPS+HSTS, `X-Frame-Options`, `nosniff`, `poweredByHeader: false`
- Admin: sessões de 12h com revogação, bcrypt, MFA TOTP, rate limit no login
- Pi: `PI_API_KEY` obrigatória em produção; claim anti-duplo idempotente
- Webhook MP com assinatura (quando `MP_WEBHOOK_SECRET` setado) + rate limit
- Validação server-side (tipos, tamanhos, páginas reais do PDF, tetos)
- Arquivos cifrados em repouso (AES-256-GCM); `data/` com chmod 700
- CORS: APIs sem `Access-Control-Allow-Origin` (same-origin only)
- SQL injection: N/A (sem SQL; JSON + Postgres só no futuro com ORM)

## Pós-lançamento (evoluir)
- Postgres + Prisma (concorrência real), S3/R2 p/ PDFs grandes
- WAF/Cloudflare, UFW + fail2ban + unattended-upgrades na VPS
- Monitoramento (uptime + `pm2 logs` + alerta Telegram de pico)
