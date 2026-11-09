#!/usr/bin/env bash
# Publica o Emaús no Raspberry (host "rasp"): rsync + build remoto + restart do systemd.
# Uso: deploy/deploy-rasp.sh [--seed]   (--seed APAGA o banco e carrega o cenário demo)
set -euo pipefail

HOST="${EMAUS_HOST:-rasp}"
DIR="${EMAUS_DIR:-~/services/emaus}"

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude '.env*' --exclude data \
  --exclude .git --exclude '.shot.mjs' --exclude '.flow.mjs' \
  ./ "$HOST:$DIR/"

ssh "$HOST" bash -s -- "$DIR" "${1:-}" <<'REMOTE'
set -euo pipefail
cd "$1"
mkdir -p data
if [ ! -f .env ]; then
  printf 'DATABASE_URL=file:./data/emaus.db\nBETTER_AUTH_SECRET=%s\nBETTER_AUTH_URL=%s\n' \
    "$(openssl rand -base64 32)" "${EMAUS_PUBLIC_URL:-https://rasp.tail2df097.ts.net:8444}" > .env
  chmod 600 .env
fi
npm ci --no-audit --no-fund
npm run db:migrate
if [ "${2:-}" = "--seed" ]; then npm run db:seed; fi
npm run build
sudo systemctl restart emaus
sleep 3
systemctl is-active emaus
REMOTE
