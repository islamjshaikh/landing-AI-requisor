#!/bin/bash
# CrewAI Service Startup Script

echo "🤖 Starting CrewAI service..."
cd mycrewai
export PYTHONPATH=.
export OPENAI_API_KEY="$OPENAI_API_KEY"

# Kill any existing uvicorn processes
pkill -f "uvicorn.*api.main" || true
sleep 2

# Start CrewAI service
nohup python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --log-level info > /tmp/crewai.log 2>&1 &
CREWAI_PID=$!

echo "🤖 CrewAI service started with PID: $CREWAI_PID"
echo "📋 Service will be available at: http://localhost:8000"
echo "📄 Logs available at: /tmp/crewai.log"

# Wait and test
sleep 5
if curl -s http://localhost:8000/health > /dev/null; then
  echo "✅ CrewAI service is running and healthy!"
else
  echo "❌ CrewAI service failed to start properly"
fi