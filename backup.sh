#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="./backups/clash_db_${TIMESTAMP}.sql"

# Загружаем переменные из .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-clash_db}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}

# Проверяем, запущен ли контейнер
if ! docker ps | grep -q clash-server-postgres; then
    echo "❌ PostgreSQL container is not running!"
    exit 1
fi

# Передаём пароль через переменную окружения
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" \
  clash-server-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_FILE"

# Сжимаем
gzip "$BACKUP_FILE"

# Удаляем старые бэкапы (старше 30 дней)
find ./backups -name "*.sql.gz" -mtime +30 -delete

echo "✅ Backup created: ${BACKUP_FILE}.gz"