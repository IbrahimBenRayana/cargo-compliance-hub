#!/bin/bash
# MyCargoLens — Start both servers
# Usage: ./start.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🧹 Cleaning up old processes..."
pkill -f "tsx src/index" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

echo ""
echo "🗄️  Starting Backend (port 3001)..."
cd "$SCRIPT_DIR/server"
npx tsx src/index.ts &
BACKEND_PID=$!
sleep 3

echo ""
echo "🌐 Starting Frontend (port 8080)..."
cd "$SCRIPT_DIR"
npx vite --port 8080 &
FRONTEND_PID=$!
sleep 2

echo ""
echo "============================================"
echo "  ✅ MyCargoLens is running!"
echo ""
echo "  Frontend:  http://localhost:8080"
echo "  Backend:   http://localhost:3001"
echo ""
echo "  Login:     demo@mycargolens.com"
echo "  Password:  password123"
echo ""
echo "  Press Ctrl+C to stop both servers"
echo "============================================"
echo ""

# Wait for Ctrl+C and clean up both
trap "echo ''; echo '🛑 Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
