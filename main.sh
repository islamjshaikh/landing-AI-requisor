#!/bin/bash
echo "[PRODUCTION] Starting both Node.js and CrewAI services..."

# Set environment
export PORT=8080
export NODE_ENV=production
export PYTHONPATH=.

# Clear port conflicts
echo "[PRODUCTION] Clearing port conflicts..."
for port in 8080 8000; do
    EXISTING_PROCESSES=$(lsof -t -i:$port 2>/dev/null || true)
    if [ -n "$EXISTING_PROCESSES" ]; then
        echo "[PRODUCTION] Clearing port $port conflicts..."
        kill $EXISTING_PROCESSES 2>/dev/null || true
    fi
done
sleep 2

# Install dependencies
echo "[PRODUCTION] Installing Node.js dependencies..."
npm install >/dev/null 2>&1 || true

echo "[PRODUCTION] Installing Python dependencies..."
pip install -q -r requirements.txt

# Start Node.js server (main app)
echo "[PRODUCTION] Starting Node.js server on port 8080..."
node dist/index.js &
NODE_PID=$!

# Start Python CrewAI server 
echo "[PRODUCTION] Starting CrewAI FastAPI server on port 8000..."
cd mycrewai && python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 &
CREWAI_PID=$!
cd ..

echo "[PRODUCTION] Both servers started!"
echo "Node.js server PID: $NODE_PID"
echo "CrewAI server PID: $CREWAI_PID"
echo "Servers accessible at:"
echo "- Main App: Port 8080 → External Port 80"  
echo "- CrewAI API: Port 8000 → External Port 8000"

# Wait for both servers to start
sleep 5

# Health checks
echo "[PRODUCTION] Performing health checks..."
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
  echo "[PRODUCTION] ✅ Node.js server healthy on port 8080"
else
  echo "[PRODUCTION] ❌ Node.js server failed on port 8080"
fi

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
  echo "[PRODUCTION] ✅ CrewAI server healthy on port 8000"  
else
  echo "[PRODUCTION] ❌ CrewAI server failed on port 8000"
fi

echo "[PRODUCTION] 🚀 Multi-service deployment completed!"

# Cleanup function
cleanup() {
    echo "[PRODUCTION] Shutting down both servers..."
    kill $NODE_PID $CREWAI_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT
wait