#!/usr/bin/env bash
set -euo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "Pulling lean Ollama models (2 models, ~8 GB RAM)..."
echo "Target: $OLLAMA_HOST"

models=(
  "llama3.1:8b"
  "nomic-embed-text"
)

for model in "${models[@]}"; do
  echo "Pulling $model..."
  ollama pull "$model"
done

echo "Lean models ready. Use: cp .env.lean.example .env"
