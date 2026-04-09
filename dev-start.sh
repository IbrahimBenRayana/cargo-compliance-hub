#!/usr/bin/env bash
#
# dev-start.sh — Start backend + frontend in parallel with clean log separation.
#
# Usage:
#   ./dev-start.sh          Start both servers
#   ./dev-start.sh --kill   Kill any running servers on ports 3001 & 8080
#
# Logs:
#   Backend  → .dev-logs/backend.log   (also printed in cyan)
#   Frontend → .dev-logs/frontend.log  (also printed in green)
#
# Press Ctrl-C to stop both servers.

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/.dev-logs"
BACKEND_PORT=3001
FRONTEND_PORT=8080

# ─── Colors ──────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── Kill mode ──────────────────────────────────────────────
kill_servers() {
  echo -e "${YELLOW}Killing processes on ports $BACKEND_PORT and $FRONTEND_PORT...${NC}"
  lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null && echo -e "  ${RED}Killed backend on :$BACKEND_PORT${NC}" || echo -e "  Nothing on :$BACKEND_PORT"
  lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null && echo -e "  ${RED}Killed frontend on :$FRONTEND_PORT${NC}" || echo -e "  Nothing on :$FRONTEND_PORT"
}

if [ "$1" = "--kill" ]; then
  kill_servers
  exit 0
fi

# ─── Pre-flight ─────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# Kill any existing processes on our ports
kill_servers 2>/dev/null || true
sleep 1

echo ""
echo -e "${BOLD}🚀 MyCargoLens Dev Startup${NC}"
echo -e "   Root:     $ROOT_DIR"
echo -e "   Backend:  ${CYAN}http://localhost:$BACKEND_PORT${NC}"
echo -e "   Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo ""

# ─── Trap Ctrl-C to kill both children ──────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  echo -e "${GREEN}✅ All servers stopped.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ─── Start Backend ──────────────────────────────────────────
(
  cd "$ROOT_DIR/server"
  npx tsx src/index.ts 2>&1 | while IFS= read -r line; do
    echo "$line" >> "$LOG_DIR/backend.log"
    echo -e "${CYAN}[API]${NC} $line"
  done
) &
BACKEND_PID=$!

# Wait for backend to be ready
echo -e "${CYAN}[API]${NC} Starting backend..."
for i in $(seq 1 30); do
  if curl -s http://localhost:$BACKEND_PORT/api/v1/auth/login > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# ─── Start Frontend ────────────────────────────────────────
(
  cd "$ROOT_DIR"
  npx vite --port $FRONTEND_PORT 2>&1 | while IFS= read -r line; do
    echo "$line" >> "$LOG_DIR/frontend.log"
    echo -e "${GREEN}[WEB]${NC} $line"
  done
) &
FRONTEND_PID=$!

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  ✅ Both servers running — press Ctrl-C to stop  ${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""

# ─── Wait for either to exit ───────────────────────────────
wait $BACKEND_PID $FRONTEND_PID
