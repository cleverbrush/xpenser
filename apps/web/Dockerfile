FROM node:22-alpine AS builder

WORKDIR /app
ARG DISABLE_GTM=0
ENV DISABLE_GTM=$DISABLE_GTM

COPY package.json turbo.json tsconfig.base.json tsconfig.json vitest.config.ts biome.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/telegram-bot/package.json ./apps/telegram-bot/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY packages/timezone/package.json ./packages/timezone/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN npm install --ignore-scripts

COPY apps/web ./apps/web
COPY packages ./packages

RUN npm run build -w @xpenser/contracts && \
    npm run build -w @xpenser/client && \
    npm run build -w @xpenser/timezone && \
    npm run build -w @xpenser/ui && \
    npm run build -w @xpenser/web

FROM node:22-alpine AS runtime

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/content ./apps/web/content

RUN mkdir -p /app/apps/web/.next/cache && \
    chown -R appuser:appgroup /app/apps/web/.next/cache

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

USER appuser

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node apps/web/server.js"]
