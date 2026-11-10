#!/usr/bin/env bash
# Cria o venv de scripts/ e instala as dependências de ingestão/testes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/scripts/venv"

python3 -m venv "$VENV"
"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/pip" install -r "$ROOT/scripts/requirements.txt"

echo "OK: $VENV"
echo "Windows: scripts\\venv\\Scripts\\python -m pip install -r scripts\\requirements.txt"
