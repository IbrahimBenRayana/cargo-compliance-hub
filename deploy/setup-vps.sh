#!/bin/bash
# ============================================================
# MyCargoLens — VPS Deployment Script
# ============================================================
# This script sets up MyCargoLens on a fresh Ubuntu/Debian VPS.
#
# Prerequisites:
#   - Ubuntu 22.04+ or Debian 12+
#   - Root or sudo access
#   - Domain pointed to your server's IP (optional but recommended)
#
# Usage:
#   scp deploy/setup-vps.sh user@your-server:/tmp/
#   ssh user@your-server "sudo bash /tmp/setup-vps.sh"
#
# After setup, configure .env and start:
#   cd /opt/mycargolens
#   nano .env                    # Fill in secrets
#   docker compose up -d         # Start everything
#   docker compose exec server npx tsx prisma/seed.ts  # Optional: seed demo data
# ============================================================

set -euo pipefail

APP_DIR="/opt/mycargolens"
GHCR_IMAGE="ghcr.io/ibrahimbenrayana/cargo-compliance-hub"

echo "============================================"
echo " MyCargoLens — VPS Setup"
echo "============================================"
echo ""

# ── 1. Install Docker ──────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "📦 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "✅ Docker installed"
else
  echo "✅ Docker already installed"
fi

# ── 2. Install Docker Compose plugin ───────────────────────
if ! docker compose version &> /dev/null; then
  echo "📦 Installing Docker Compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
  echo "✅ Docker Compose installed"
else
  echo "✅ Docker Compose already installed"
fi

# ── 3. Create app directory ────────────────────────────────
echo "📂 Creating app directory at $APP_DIR..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# ── 4. Create docker-compose.prod.yml ──────────────────────
echo "📝 Creating docker-compose.prod.yml..."
cat > docker-compose.prod.yml << 'COMPOSE_EOF'
services:
  db:
    image: postgres:16-alpine
    container_name: mycargolens-db
    restart: always
    environment:
      POSTGRES_DB: mycargolens
      POSTGRES_USER: mycargolens
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mycargolens -d mycargolens"]
      interval: 5s
      timeout: 5s
      retries: 10
    # No port exposed — only accessible from server container

  server:
    image: ghcr.io/ibrahimbenrayana/cargo-compliance-hub:latest
    container_name: mycargolens-server
    restart: always
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://mycargolens:${DB_PASSWORD}@db:5432/mycargolens?schema=public
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_EXPIRES_IN: ${JWT_ACCESS_EXPIRES_IN:-15m}
      JWT_REFRESH_EXPIRES_IN: ${JWT_REFRESH_EXPIRES_IN:-7d}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:3001}
      CC_API_BASE_URL: ${CC_API_BASE_URL:-https://api-cert.customscity.com}
      CC_API_TOKEN: ${CC_API_TOKEN:-}
      CC_ENVIRONMENT: ${CC_ENVIRONMENT:-sandbox}
      EMAIL_HOST: ${EMAIL_HOST:-}
      EMAIL_PORT: ${EMAIL_PORT:-587}
      EMAIL_USER: ${EMAIL_USER:-}
      EMAIL_PASS: ${EMAIL_PASS:-}
      EMAIL_FROM: ${EMAIL_FROM:-noreply@mycargolens.com}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME:-MyCargoLens}
    volumes:
      - uploads_data:/app/uploads
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3

volumes:
  postgres_data:
    driver: local
  uploads_data:
    driver: local
COMPOSE_EOF

# ── 5. Create .env template ───────────────────────────────
if [ ! -f .env ]; then
  echo "📝 Creating .env template..."
  cat > .env << 'ENV_EOF'
# ============================================================
# MyCargoLens — Production Environment Variables
# ============================================================
# IMPORTANT: Fill in all required values before starting!

# ── Database ───────────────────────────────────────────────
DB_PASSWORD=CHANGE_ME_TO_A_STRONG_PASSWORD

# ── JWT Secrets (generate with: openssl rand -hex 32) ──────
JWT_ACCESS_SECRET=CHANGE_ME
JWT_REFRESH_SECRET=CHANGE_ME
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── Frontend URL (your domain or IP) ──────────────────────
FRONTEND_URL=http://localhost:3001

# ── CustomsCity API ───────────────────────────────────────
CC_API_BASE_URL=https://api-cert.customscity.com
CC_API_TOKEN=
CC_ENVIRONMENT=sandbox

# ── Email (Azure SMTP or any SMTP provider) ───────────────
EMAIL_HOST=smtp.azurecomm.net
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@mycargolens.com
EMAIL_FROM_NAME=MyCargoLens
ENV_EOF
  echo "⚠️  IMPORTANT: Edit .env and fill in your secrets!"
else
  echo "✅ .env already exists — skipping"
fi

# ── 6. Create update script ───────────────────────────────
echo "📝 Creating update.sh script..."
cat > update.sh << 'UPDATE_EOF'
#!/bin/bash
# Pull latest image and restart
set -euo pipefail
cd /opt/mycargolens
echo "📥 Pulling latest image..."
docker compose -f docker-compose.prod.yml pull server
echo "🔄 Restarting..."
docker compose -f docker-compose.prod.yml up -d
echo "🧹 Cleaning old images..."
docker image prune -f
echo "✅ Update complete!"
docker compose -f docker-compose.prod.yml ps
UPDATE_EOF
chmod +x update.sh

# ── 7. Create backup script ──────────────────────────────
echo "📝 Creating backup.sh script..."
cat > backup.sh << 'BACKUP_EOF'
#!/bin/bash
# Backup PostgreSQL database
set -euo pipefail
cd /opt/mycargolens
BACKUP_DIR="/opt/mycargolens/backups"
mkdir -p "$BACKUP_DIR"
FILENAME="mycargolens_$(date +%Y%m%d_%H%M%S).sql.gz"
echo "💾 Backing up database..."
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U mycargolens mycargolens | gzip > "$BACKUP_DIR/$FILENAME"
echo "✅ Backup saved: $BACKUP_DIR/$FILENAME"
# Keep only last 30 backups
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm --
echo "🧹 Old backups cleaned (keeping last 30)"
BACKUP_EOF
chmod +x backup.sh

# ── 8. Setup daily backup cron ────────────────────────────
if ! crontab -l 2>/dev/null | grep -q "mycargolens/backup.sh"; then
  echo "⏰ Setting up daily backup cron job..."
  (crontab -l 2>/dev/null; echo "0 3 * * * /opt/mycargolens/backup.sh >> /opt/mycargolens/backups/cron.log 2>&1") | crontab -
  echo "✅ Daily backup scheduled at 3:00 AM"
else
  echo "✅ Backup cron already configured"
fi

echo ""
echo "============================================"
echo " ✅ VPS Setup Complete!"
echo "============================================"
echo ""
echo " Next steps:"
echo "   1. Edit secrets:     nano $APP_DIR/.env"
echo "   2. Generate JWT secrets:"
echo "      openssl rand -hex 32   # Use for JWT_ACCESS_SECRET"
echo "      openssl rand -hex 32   # Use for JWT_REFRESH_SECRET"
echo "   3. Start the app:   cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d"
echo "   4. Seed demo data:  docker compose -f docker-compose.prod.yml exec server npx tsx prisma/seed.ts"
echo "   5. Check health:    curl http://localhost:3001/api/health"
echo ""
echo " Maintenance:"
echo "   Update:  $APP_DIR/update.sh"
echo "   Backup:  $APP_DIR/backup.sh"
echo "   Logs:    docker compose -f docker-compose.prod.yml logs -f server"
echo "   Status:  docker compose -f docker-compose.prod.yml ps"
echo ""
echo " Optional: Set up Nginx reverse proxy + SSL with Certbot"
echo "   apt install nginx certbot python3-certbot-nginx"
echo ""
