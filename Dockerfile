FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate proto files
RUN bun run proto:gen

# Run migrations and start
CMD ["sh", "-c", "bun run db:migrate && bun run start"]