# Build stage
FROM oven/bun:1.3.10-alpine AS builder

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY tsconfig.json bun.config.ts ./
COPY src/ ./src/

RUN bun run build

# Production stage
FROM oven/bun:1.3.10-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN addgroup -g 1000 -S nanobot && \
    adduser -S -G nanobot -u 1000 -h /home/nanobot -s /bin/sh nanobot && \
    chown -R nanobot:nanobot /app

USER nanobot

ENV BUN_ENV=production
ENV NODE_ENV=production
ENV NANOBOT_HOME=/home/nanobot/.nanobot

EXPOSE 18790

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep -f "bun.*dist/cli/run.js" || exit 1

CMD ["bun", "dist/cli/run.js", "gateway"]
