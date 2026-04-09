# ============================================================
# MyCargoLens — Multi-stage Production Dockerfile
# ============================================================
# Stage 1: Install deps & build frontend
# Stage 2: Install server deps & generate Prisma
# Stage 3: Lean production image
# ============================================================

# ── Stage 1: Build Frontend ─────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* bun.lock* ./

# Install frontend deps
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy frontend source + configs
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tailwind.config.ts postcss.config.js components.json ./
COPY src/ ./src/
COPY public/ ./public/

# Build args for frontend env (injected at build time)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build the frontend
RUN npm run build


# ── Stage 2: Build Server ───────────────────────────────────
FROM node:20-alpine AS server-builder

WORKDIR /app/server

# Copy server package files
COPY server/package.json server/package-lock.json* ./

# Install ALL deps (need devDependencies for tsc + prisma generate)
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy server source + prisma
COPY server/tsconfig.json server/tsconfig.build.json ./
COPY server/src/ ./src/
COPY server/prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript (use build config that excludes seed.ts)
RUN npx tsc --project tsconfig.build.json


# ── Stage 3: Production Image ───────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Install production server deps only
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --frozen-lockfile 2>/dev/null || npm install --omit=dev

# Copy Prisma schema + generated client + migrations
COPY server/prisma/ ./prisma/
COPY --from=server-builder /app/server/node_modules/.prisma ./node_modules/.prisma
COPY --from=server-builder /app/server/node_modules/@prisma ./node_modules/@prisma

# Copy compiled server
COPY --from=server-builder /app/server/dist ./dist

# Copy built frontend → served as static files
COPY --from=frontend-builder /app/dist ./public-frontend

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app/uploads

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start via entrypoint (runs migrations then server)
ENTRYPOINT ["./docker-entrypoint.sh"]
