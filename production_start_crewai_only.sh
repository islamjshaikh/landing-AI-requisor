#!/usr/bin/env bash
set -euo pipefail

# CREWAI-ONLY PRODUCTION SCRIPT - Shows only CrewAI connection status

export PORT=8080
export NODE_ENV=production
export PYTHONPATH=.

# Silent startup of Node.js server
node dist/index.js > /dev/null 2>&1 &
BACKEND_PID=$!
sleep 3

# Silent installation of Python dependencies
pip install -r requirements.txt > /dev/null 2>&1

# Start CrewAI service silently
cd mycrewai/api
python main.py > /dev/null 2>&1 &
UVICORN_PID=$!
cd ../..

# Give CrewAI time to initialize
sleep 10

# CONTINUOUS CONNECTION PINGING - Shows only "connecting..." until connected
echo "Connecting to CrewAI..."
PORT_8001_READY=false

while [ "$PORT_8001_READY" = false ]; do
  if curl_output=$(curl -s http://localhost:8001/health 2>&1); then
    if [[ "$curl_output" == *"ok"* ]]; then
      echo "✅ CONNECTED!"
      echo "CrewAI Response: $curl_output"
      PORT_8001_READY=true
      break
    fi
  fi
  
  echo "Connecting..."
  sleep 2
done

# Keep monitoring and show only CrewAI logs
echo "CrewAI is now operational - monitoring connection..."
while true; do
  if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅ CrewAI: Connected"
  else
    echo "❌ CrewAI: Disconnected"
  fi
  sleep 5
done