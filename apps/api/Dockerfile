FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json tsup.config.ts ./
COPY src/ ./src/

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/
HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "./dist/telemetry.js", "dist/index.js"]
