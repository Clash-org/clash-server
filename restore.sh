#!/bin/bash
set -e  # Останавливаем скрипт при ошибке

# Загружаем переменные из .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-clash_db}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh backup_file.sql.gz"
    echo "Example: ./restore.sh ./backups/clash_db_20240101_020000.sql.gz"
    exit 1
fi

# Проверяем, существует ли файл
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Проверяем, запущен ли контейнер
if ! docker ps | grep -q clash-server-postgres; then
    echo "❌ PostgreSQL container is not running!"
    exit 1
fi

echo "🔄 Restoring from: $BACKUP_FILE"

# Восстанавливаем с паролем
gunzip -c "$BACKUP_FILE" | docker exec -i \
    -e PGPASSWORD="$POSTGRES_PASSWORD" \
    clash-server-postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

echo "✅ Restored successfully from: $BACKUP_FILE"