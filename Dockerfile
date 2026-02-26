# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.30.2

# Install dependencies
COPY package*.json ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/

# Build
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.30.2

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g nanobot -S && \
    adduser -S -G nanobot -h /home/nanobot -s /bin/sh nanobot && \
    chown -R nanobot:nanobot /app

USER nanobot

# Set environment
ENV NODE_ENV=production
ENV NANOBOT_HOME=/home/nanobot/.nanobot

# Expose port (for any HTTP server in the future)
EXPOSE 18790

# Health check - check if the node process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep -f "node.*dist/cli/index.js" || exit 1

# Run
CMD ["node", "dist/cli/run.js", "gateway"]
