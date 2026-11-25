#!/usr/bin/env bash
# Publica a CENTRAL INFRA RO 360 no GitHub.
#
#   bash scripts/publicar_github.sh <TOKEN_GITHUB> [URL_DO_REPOSITORIO]
#
# O token e um Personal Access Token (classic ou fine-grained) do GitHub com
# escopo `repo`. Ele e usado apenas no push — nunca e gravado no repositorio,
# no remote persistido nem em arquivo de configuracao.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

TOKEN="${1:-}"
ORIGEM="${2:-https://github.com/hfjuniormao/central-infra-ro.git}"

if [ -z "$TOKEN" ]; then
  echo "Uso: bash scripts/publicar_github.sh <TOKEN_GITHUB> [URL_DO_REPOSITORIO]"
  echo "  Token: https://github.com/settings/tokens (escopo repo, repositorio privado)"
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "ERRO: este diretorio nao e um repositorio git."
  exit 1
fi

echo ">> Verificando estrutura…"
npm run lint

echo ">> Testes unitarios…"
npm test

# O remote persistido guarda apenas a URL publica (sem token).
git remote remove origin 2>/dev/null || true
git remote add origin "$ORIGEM"
git branch -M main

# Token usado apenas nesta operacao, via URL efemera.
URL_COM_TOKEN="${ORIGEM/https:\/\//https:\/\/${TOKEN}@}"

echo ">> Enviando para $ORIGEM (branch main)…"
set +e
git push -u "$URL_COM_TOKEN" main 2>&1 | tee /tmp/git-push.log
STATUS=${PIPESTATUS[0]}
set -e

if [ "$STATUS" -ne 0 ]; then
  echo
  echo ">> O push falhou. Causas provaveis:"
  echo "   - token sem escopo 'repo' ou expirado;"
  echo "   - conta sem acesso ao repositorio;"
  echo "   - branch 'main' ja existente com historico diferente (use --force-with-lease com cuidado)."
  echo "   Log: /tmp/git-push.log"
  exit "$STATUS"
fi

# Remove o token do remote persistido (o remote ja aponta para a URL publica).
git remote set-url origin "$ORIGEM"
git fetch origin 2>/dev/null || true
git branch --set-upstream-to=origin/main main 2>/dev/null || true

echo
echo ">> Publicado. Branch local: $(git branch --show-current) | HEAD: $(git rev-parse --short HEAD)"
echo ">> Repositorio: $ORIGEM"
