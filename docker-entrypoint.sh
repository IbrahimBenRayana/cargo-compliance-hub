#!/bin/sh
# ============================================================
# MyCargoLens — Docker entrypoint
# Runs Prisma migrations, then starts the server
# ============================================================

set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "🚀 Starting MyCargoLens server..."
exec node dist/index.js
