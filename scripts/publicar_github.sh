#!/usr/bin/env bash
# Publica a CENTRAL INFRA RO 360 no GitHub.
#
#   bash scripts/publicar_github.sh <TOKEN_GITHUB> [URL_DO_REPOSITORIO]
#
# O token e um Personal Access Token (classic ou fine-grained) do GitHub com
# escopo `repo`. Ele e entregue ao git por GIT_ASKPASS — nunca entra na URL do
# remote, nunca e gravado no `.git/config` nem em arquivo do repositorio.
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

# Remote persistido: apenas a URL publica, sem credencial.
git remote remove origin 2>/dev/null || true
git remote add origin "$ORIGEM"
git branch -M main

# Credencial entregue ao git por um helper temporario (fora do repositorio).
ARQUIVO_TOKEN="$(mktemp)"
ARQUIVO_ASKPASS="$(mktemp)"
cleanup() { rm -f "$ARQUIVO_TOKEN" "$ARQUIVO_ASKPASS"; }
trap cleanup EXIT
printf '%s' "$TOKEN" > "$ARQUIVO_TOKEN"
chmod 600 "$ARQUIVO_TOKEN"

cat > "$ARQUIVO_ASKPASS" <<'ASKPASS'
#!/usr/bin/env bash
case "$1" in
  *sername*) printf '%s' "x-access-token" ;;
  *assword*) cat "$GIT_ASKPASS_TOKEN_FILE" ;;
  *) printf '%s' "" ;;
esac
ASKPASS
chmod 700 "$ARQUIVO_ASKPASS"

echo ">> Enviando para $ORIGEM (branch main)…"
set +e
GIT_ASKPASS="$ARQUIVO_ASKPASS" \
GIT_ASKPASS_TOKEN_FILE="$ARQUIVO_TOKEN" \
GIT_TERMINAL_PROMPT=0 \
  git push -u origin main 2>&1 | tee /tmp/git-push.log
STATUS=${PIPESTATUS[0]}
set -e

if [ "$STATUS" -ne 0 ]; then
  echo
  echo ">> O push falhou. Causas provaveis:"
  echo "   - token sem escopo 'repo' ou expirado;"
  echo "   - conta sem acesso ao repositorio;"
  echo "   - branch 'main' no remoto com historico diferente."
  echo "   Log: /tmp/git-push.log"
  exit "$STATUS"
fi

git fetch origin 2>/dev/null || true
git branch --set-upstream-to=origin/main main 2>/dev/null || true

echo
echo ">> Publicado. Branch local: $(git branch --show-current) | HEAD: $(git rev-parse --short HEAD)"
echo ">> Repositorio: $ORIGEM"
