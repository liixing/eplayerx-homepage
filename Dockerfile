FROM oven/bun:1-alpine AS base
WORKDIR /app

# --- install dependencies ---
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- run ---
FROM base
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "src/serve.ts"]
