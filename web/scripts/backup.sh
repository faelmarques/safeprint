#!/bin/bash
# Backup do banco JSON + .env (antes de todo deploy e 1x/dia via cron).
# Uso: ./scripts/backup.sh
set -e
APP_DIR="/root/safeprint/web"
BACKUP_DIR="/root/backups/safeprint"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/data-$STAMP.tar.gz" -C "$APP_DIR" data .env
chmod 600 "$BACKUP_DIR/data-$STAMP.tar.gz"
# mantém os 14 mais recentes
ls -t "$BACKUP_DIR"/data-*.tar.gz | tail -n +15 | xargs -r rm --
echo "OK: $BACKUP_DIR/data-$STAMP.tar.gz"
