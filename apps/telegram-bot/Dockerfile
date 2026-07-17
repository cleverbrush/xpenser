FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json tsconfig.json vitest.config.ts biome.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/telegram-bot/package.json ./apps/telegram-bot/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY packages/timezone/package.json ./packages/timezone/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN npm ci --ignore-scripts

COPY apps/telegram-bot ./apps/telegram-bot
COPY packages ./packages

RUN npm run build -w @xpenser/contracts && \
    npm run build -w @xpenser/client && \
    npm run build -w @xpenser/timezone && \
    npm run build -w @xpenser/telegram-bot

FROM node:22-alpine AS runtime

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/telegram-bot/node_modules ./apps/telegram-bot/node_modules
COPY --from=builder /app/apps/telegram-bot/dist ./apps/telegram-bot/dist
COPY --from=builder /app/apps/telegram-bot/package.json ./apps/telegram-bot/package.json

WORKDIR /app/apps/telegram-bot

RUN node --input-type=module --eval "import.meta.resolve('@cleverbrush/env')"

ENV NODE_ENV=production

USER appuser

CMD ["node", "--import", "@opentelemetry/instrumentation/hook.mjs", "--import", "./dist/telemetry.js", "dist/index.js"]
