#!/usr/bin/env bash
set -euo pipefail

# PRODUCTION SCRIPT - Node.js only (CrewAI is external service)
export PORT=8080
export NODE_ENV=production

echo "[PRODUCTION] Starting Requisor production deployment..."

# FORCE KILL ALL EXISTING PROCESSES ON PORT 8080
echo "[PRODUCTION] Force clearing ALL port 8080 processes..."
pkill -f "server/index.ts" 2>/dev/null || true
pkill -f "tsx.*server" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true
sleep 2

# Start server FIRST to satisfy Replit's port requirement quickly
echo "[PRODUCTION] Starting Node.js server on port 8080..."
cd /home/runner/workspace && tsx server/index.ts &
BACKEND_PID=$!

# Wait for port to open (reduced timeout)
echo "[PRODUCTION] Waiting for port 8080 to open..."
TIMEOUT=30
COUNTER=0
while [ $COUNTER -lt $TIMEOUT ]; do
  if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "[PRODUCTION] ✅ Port 8080 is now RESPONDING after ${COUNTER}s"
    break
  fi
  sleep 1
  COUNTER=$((COUNTER + 1))
done

if [ $COUNTER -ge $TIMEOUT ]; then
  echo "[PRODUCTION] ❌ Timeout: Port 8080 failed to respond within ${TIMEOUT}s"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

# Now do background operations while server is running
echo "[PRODUCTION] 🔧 Syncing database schema in background..."
npm run db:push --force &
SCHEMA_PID=$!

# Wait for schema sync to complete
wait $SCHEMA_PID
if [ $? -eq 0 ]; then
    echo "[PRODUCTION] ✅ Database schema synced successfully"
else
    echo "[PRODUCTION] ⚠️ Database schema sync failed, but server is running"
fi

echo "[PRODUCTION] 🚀 Production deployment ready!"
echo "[PRODUCTION] - Node.js server: 0.0.0.0:8080 → External Port 80"
echo "[PRODUCTION] - CrewAI service: External Backend"

# Function to cleanup on exit
cleanup() {
    echo "[PRODUCTION] Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT
wait

# If process exits, cleanup
echo "[PRODUCTION] Service process exited"
cleanup