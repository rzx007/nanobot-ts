# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/

# Build
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:18790/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 0

# Run
CMD ["node", "dist/cli/index.js", "gateway"]
