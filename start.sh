#!/bin/bash
# WhyJarv — avvia tutto con un comando

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "⚡ WhyJarv — avvio in corso..."

# Installa dipendenze Python se mancanti
if [ ! -d ".venv" ]; then
  echo "Creando virtualenv..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

# Build frontend se mancante
if [ ! -d "frontend/dist" ]; then
  echo "Building frontend..."
  cd frontend
  npm install -q
  npm run build
  cd ..
fi

# Avvia backend
echo "Avvio backend su :8340..."
python server.py &
BACKEND_PID=$!

# Attendi che sia pronto
sleep 3

# Apri browser
echo "Apertura browser..."
open "http://localhost:8340"

echo ""
echo "✓ WhyJarv attivo. Dì 'Let\'s start' per attivare."
echo "  Backend PID: $BACKEND_PID"
echo "  Ctrl+C per fermare."
echo ""

cleanup() {
  echo "Spegnendo WhyJarv..."
  kill $BACKEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

wait
