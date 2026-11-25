#!/usr/bin/env bash
# Gera o ZIP de entrega do CENTRAL INFRA RO 360.
# Exclui node_modules, .git, caches e credenciais.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SAIDA="${1:-$RAIZ/central-infra-ro-360.zip}"
NOME="central-infra-ro-360"

cd "$RAIZ"

if [ -f "$SAIDA" ]; then
  echo ">> Removendo pacote anterior: $SAIDA"
  rm -f "$SAIDA"
fi

echo ">> Empacotando $NOME ..."
zip -r -q "$SAIDA" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x "*.zip" \
  -x "scripts/.cache/*" \
  -x "tests/capturas/*" \
  -x ".env" -x ".env.local" -x ".env.*.local" \
  -x "**/__pycache__/*" \
  -x "**/*.pyc"

echo ">> Concluído: $SAIDA ($(du -h "$SAIDA" | cut -f1))"
