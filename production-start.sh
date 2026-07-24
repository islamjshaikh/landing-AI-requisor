#!/bin/bash

# Production start script for Requisor
echo "🚀 Starting Requisor in production mode..."

# Set environment variables
export NODE_ENV=production
export PORT=80

# Create log directories
mkdir -p logs/backend logs/frontend logs/crewai

# Start services with proper logging
echo "📦 Building application..."
npm run build

echo "🖥️ Starting backend server..."
node dist/index.js > logs/backend/backend-$(date '+%Y-%m-%d-%H-%M-%S').log 2>&1 &
BACKEND_PID=$!

echo "🤖 Starting CrewAI service..."
cd mycrewai
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --log-level info > ../logs/crewai/crewai-$(date '+%Y-%m-%d-%H-%M-%S').log 2>&1 &
CREWAI_PID=$!
cd ..

echo "✅ Services started:"
echo "   Backend: PID $BACKEND_PID (port 80)"
echo "   CrewAI: PID $CREWAI_PID (port 8000)"
echo "📊 Logs in: logs/"

# Cleanup function
cleanup() {
  echo "🛑 Shutting down services..."
  kill $BACKEND_PID $CREWAI_PID 2>/dev/null
  exit 0
}

# Handle shutdown signals
trap cleanup SIGINT SIGTERM

# Keep running
wait