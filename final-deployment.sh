#!/bin/bash

echo "🚀 Final Deployment of Requisor..."

# Set production environment
export NODE_ENV=production
export PORT=80

# Kill any existing processes
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "uvicorn api.main:app" 2>/dev/null || true

# Build the application
echo "📦 Building application for production..."
npm run build

# Create log directories
mkdir -p logs/backend logs/crewai

# Start CrewAI service
echo "🤖 Starting CrewAI service..."
cd mycrewai
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --log-level info > ../logs/crewai/crewai-$(date '+%Y-%m-%d-%H-%M-%S').log 2>&1 &
CREWAI_PID=$!
cd ..

# Wait for CrewAI to start
sleep 5

# Start the main application
echo "🖥️ Starting Requisor server on port 80..."
node dist/index.js > logs/backend/backend-$(date '+%Y-%m-%d-%H-%M-%S').log 2>&1 &
BACKEND_PID=$!

echo "✅ Deployment complete!"
echo "📊 Services:"
echo "   • Backend: PID $BACKEND_PID (port 80)"
echo "   • CrewAI: PID $CREWAI_PID (port 8000)"
echo "📄 Logs: logs/backend/ and logs/crewai/"
echo "🌐 Application: https://requisor-ai-or-private-betayashversion-3-naveen50.replit.app"

# Cleanup function
cleanup() {
  echo "🛑 Shutting down services..."
  kill $BACKEND_PID $CREWAI_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait