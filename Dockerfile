# IntentVision Production Dockerfile
# Multi-stage build for optimized Cloud Run deployment
#
# Beads Task: intentvision-xyq.1
# Build: docker build -t intentvision .
# Run: docker run -p 8080:8080 intentvision

# =============================================================================
# Stage 1: Builder - Install dependencies and compile TypeScript
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for caching
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/pipeline/package*.json ./packages/pipeline/
COPY packages/operator/package*.json ./packages/operator/
COPY packages/agent/package*.json ./packages/agent/
COPY packages/functions/package*.json ./packages/functions/

# Install all dependencies (including dev for build)
RUN npm ci --include=dev

# Copy source code
COPY packages/ ./packages/
COPY tsconfig*.json ./

# Build all packages
RUN npm run build --workspace=@intentvision/contracts || true
RUN npm run build --workspace=@intentvision/pipeline || true
RUN npm run build --workspace=@intentvision/operator || true
RUN npm run build --workspace=@intentvision/agent || true
RUN npm run build --workspace=@intentvision/functions

# =============================================================================
# Stage 2: Production - Minimal runtime image
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S intentvision -u 1001

# Copy package files
COPY package*.json ./
COPY packages/functions/package*.json ./packages/functions/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=@intentvision/functions && \
    npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/packages/functions/dist ./packages/functions/dist
COPY --from=builder /app/packages/pipeline/dist ./packages/pipeline/dist
COPY --from=builder /app/packages/operator/dist ./packages/operator/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist

# Copy database migrations
COPY --from=builder /app/db ./db

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV FUNCTION_TARGET=runPipeline
ENV K_SERVICE=intentvision

# Expose Cloud Run port
EXPOSE 8080

# Switch to non-root user
USER intentvision

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the functions framework
CMD ["npx", "functions-framework", "--target=runPipeline", "--source=packages/functions/dist/", "--port=8080"]
