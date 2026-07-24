#!/bin/bash
echo "[DEV] Starting development server (CrewAI is external service)..."

# Ensure we're in the script's directory (repo root)
cd "$(dirname "$0")"

# Set development environment early
export NODE_ENV=development
export PORT=8080
export NPM_CONFIG_PRODUCTION=false
export npm_config_production=false

# Install dependencies if not present
echo "[DEV] Checking dependencies..."
if [ ! -d node_modules/vite ]; then
    echo "[DEV] Installing dependencies (including dev)..."
    npm ci --include=dev || npm install --include=dev
    if [ ! -d node_modules/vite ] || [ ! -x node_modules/.bin/tsx ]; then
        echo "[DEV] Missing dev deps (vite/tsx). Check .npmrc for production/omit settings."
        exit 1
    fi
fi

# Clear any existing processes on Node.js port
echo "[DEV] Clearing port conflicts..."
EXISTING_PROCESSES=$(lsof -t -i:8080 2>/dev/null || true)
if [ -n "$EXISTING_PROCESSES" ]; then
    echo "[DEV] Clearing port 8080 conflicts..."
    kill $EXISTING_PROCESSES 2>/dev/null || true
fi
sleep 1

# Start Node.js development server only (CrewAI is external service)
echo "[DEV] Starting Node.js development server on port 8080..."
PORT=8080 NODE_ENV=development npx tsx server/index.ts &
NODE_PID=$!

echo "[DEV] Development server started!"
echo "Node.js server PID: $NODE_PID"
echo "Development servers accessible at:"
echo "- Main App: http://localhost:8080"  
echo "- CrewAI API: External Service"

# Wait a moment and check service
sleep 3

echo "[DEV] Checking service health..."
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
  echo "[DEV] ✅ Node.js server healthy on port 8080"
else
  echo "[DEV] ❌ Node.js server failed on port 8080"
fi

echo "[DEV] 🚀 Development environment ready!"

# Cleanup function for development
cleanup() {
    echo "[DEV] Shutting down development server..."
    kill $NODE_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT
wait