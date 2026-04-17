# Stage 1: Builder
FROM oven/bun:1.2.0-alpine AS builder

WORKDIR /app

# Копируем package.json и lockfile
COPY package.json bun.lockb ./

# Устанавливаем зависимости (включая dev)
RUN bun install --frozen-lockfile

# Копируем исходники
COPY . .

# Сборка проекта
RUN bun run build

# Stage 2: Production
FROM oven/bun:1.2.0-alpine

# Устанавливаем необходимые системные пакеты
RUN apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Создаём непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Копируем package.json для production зависимостей
COPY package.json bun.lockb ./

# Устанавливаем только production зависимости
RUN bun install --production --frozen-lockfile

# Копируем собранные файлы из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/shared/translations ./src/shared/translations
COPY --from=builder /app/drizzle ./drizzle

# Копируем скрипты
COPY --from=builder /app/package.json ./

# Создаём директории для данных
RUN mkdir -p /app/data /app/backups && \
    chown -R nodejs:nodejs /app

# Переключаемся на непривилегированного пользователя
USER nodejs

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:50051/health || exit 1

EXPOSE 50051

# Запуск с миграциями
CMD ["sh", "-c", "bun run db:migrate && bun run start"]