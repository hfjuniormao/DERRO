#!/usr/bin/env bash
# Publica a CENTRAL INFRA RO 360 na Vercel.
#
#   ./scripts/publicar_vercel.sh                 # preview
#   ./scripts/publicar_vercel.sh --prod          # produção
#   VERCEL_TOKEN=<token> ./scripts/publicar_vercel.sh --prod
#
# Requer: VERCEL_TOKEN no ambiente (ou `vercel login` feito antes).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

PROD=0
for arg in "$@"; do
  case "$arg" in
    --prod) PROD=1 ;;
    *) export VERCEL_TOKEN="$arg" ;;
  esac
done

if ! command -v vercel >/dev/null 2>&1; then
  echo "Instalando a CLI da Vercel…"
  npm i -g vercel
fi

echo "→ Verificando estrutura…"
npm run lint

echo "→ Testes unitários…"
npm test

echo "→ Build…"
NODE_OPTIONS=--max-old-space-size=4096 npm run build

if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  if [[ "$PROD" == "1" ]]; then
    vercel --prod --token "$VERCEL_TOKEN"
  else
    vercel --token "$VERCEL_TOKEN"
  fi
else
  echo "→ VERCEL_TOKEN ausente: usando a sessão local da CLI (vercel login)."
  if [[ "$PROD" == "1" ]]; then
    vercel --prod
  else
    vercel
  fi
fi

echo "→ Smoke test da URL publicada (opcional): python3 tests/smoke_test.py <url>"
