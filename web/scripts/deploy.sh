#!/bin/bash
# Deploy com backup + tag (rollback em 1 comando).
# Uso: ./scripts/deploy.sh
set -e
cd /root/safeprint
./web/scripts/backup.sh
TAG="deploy-$(date +%Y%m%d-%H%M%S)"
git tag "$TAG"
git pull
cd web
npm ci
npm run build
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
echo "Deploy OK. Tag de rollback: $TAG"
echo "Rollback: cd /root/safeprint && git checkout <tag-anterior> -- web && cd web && npm run build && pm2 restart safeprint --update-env"
