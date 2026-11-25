#!/usr/bin/env bash
# Publicacao completa: GitHub (push) + Vercel (producao) + smoke test.
#
#   bash scripts/publicar_tudo.sh <GITHUB_TOKEN> <VERCEL_TOKEN>
#
# Os tokens sao usados apenas nas operacoes correspondentes e nunca sao
# gravados no repositorio nem no remote persistido.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

GITHUB_TOKEN="${1:-}"
VERCEL_TOKEN="${2:-}"
REPO_URL="${REPO_URL:-https://github.com/hfjuniormao/central-infra-ro.git}"
PROJETO_VERCEL="${PROJETO_VERCEL:-central-infra-ro-360}"

if [ -z "$GITHUB_TOKEN" ] || [ -z "$VERCEL_TOKEN" ]; then
  echo "Uso: bash scripts/publicar_tudo.sh <GITHUB_TOKEN> <VERCEL_TOKEN>"
  exit 1
fi

echo "=============================================================="
echo " 1/5  Verificacoes locais"
echo "=============================================================="
npm run lint
npm test

echo
echo "=============================================================="
echo " 2/5  GitHub — push para $REPO_URL"
echo "=============================================================="
bash scripts/publicar_github.sh "$GITHUB_TOKEN" "$REPO_URL"

echo
echo "=============================================================="
echo " 3/5  Vercel — build de producao"
echo "=============================================================="
NODE_OPTIONS=--max-old-space-size=4096 npm run build

echo
echo "=============================================================="
echo " 4/5  Vercel — deploy em producao"
echo "=============================================================="
# A CLI le o token do ambiente (VERCEL_TOKEN) — ele nao aparece na linha de comando.
export VERCEL_TOKEN
# Associa/cria o projeto (idempotente) e publica.
vercel link --yes --project "$PROJETO_VERCEL" 2>/dev/null || vercel link --yes
vercel deploy --prod --yes | tee /tmp/vercel-deploy.log

URL_PUBLICA="$(grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' /tmp/vercel-deploy.log | head -1 || true)"
if [ -z "$URL_PUBLICA" ]; then
  echo
  echo ">> Nao foi possivel extrair a URL do deploy. Confira /tmp/vercel-deploy.log"
  exit 1
fi

echo
echo "=============================================================="
echo " 5/5  Smoke test contra $URL_PUBLICA"
echo "=============================================================="
python3 tests/smoke_test.py "$URL_PUBLICA"

echo
echo "=============================================================="
echo " PUBLICADO"
echo "   GitHub : $REPO_URL"
echo "   Vercel : $URL_PUBLICA"
echo "=============================================================="
