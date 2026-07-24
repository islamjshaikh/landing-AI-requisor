#!/usr/bin/env bash
set -euo pipefail

echo "[start_all.sh] pwd=$(pwd)"
export PYTHONPATH=.

# Default PORT if not provided by Replit
export PORT="${PORT:-5000}"
echo "[start_all.sh] PORT=$PORT"

# 1) Start FastAPI (internal-only) on 127.0.0.1:8001
echo "[start_all.sh] starting uvicorn on 127.0.0.1:8001..."
uvicorn mycrewai.api.main:app --host 127.0.0.1 --port 8001 --no-access-log &
UVICORN_PID=$!

# 2) Start the Node.js Express server with npx tsx
echo "[start_all.sh] starting backend server with npx tsx..."
npx tsx server/index.ts &
BACKEND_PID=$!

# Wait for servers to start
sleep 2

# Check if both servers are running
echo "[start_all.sh] Services started. FastAPI on 8001, Express on 5000"
echo "[start_all.sh] Logs will appear below..."

# Wait for any process to exit
wait

# If any process exits, kill all
kill $UVICORN_PID $BACKEND_PID 2>/dev/null || true
