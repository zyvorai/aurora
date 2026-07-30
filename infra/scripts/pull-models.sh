#!/usr/bin/env bash
set -euo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "Pulling Ollama models for GTM Platform..."
echo "Target: $OLLAMA_HOST"

models=(
  "llama3.1:8b"
  "qwen2.5-coder:14b"
  "deepseek-r1:8b"
  "gemma2:9b"
  "nomic-embed-text"
)

for model in "${models[@]}"; do
  echo "Pulling $model..."
  ollama pull "$model"
done

echo "All models pulled successfully."
