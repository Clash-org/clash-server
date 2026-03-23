#!/bin/bash
# Надо дать праваа скрипту в консоли "chmod +x init-ollama.sh"
# Ждём запуска Ollama
sleep 10

# Загружаем модель
curl -X POST http://localhost:11434/api/pull -H 'Content-Type: application/json' -d '{"name": "qwen2.5:1.5b"}'

echo "✅ Model ready"