#!/bin/bash

# Ждём пока ollama запустится
sleep 10

# Проверяем, есть ли модель
if ! ollama list | grep -q "qwen2.5:1.5b"; then
    echo "📦 Pulling qwen2.5:1.5b model..."
    ollama pull qwen2.5:1.5b
fi

echo "✅ Ollama ready with qwen2.5:1.5b"