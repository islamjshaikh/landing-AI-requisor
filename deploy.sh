#!/bin/bash

echo "🚀 Preparing Requisor for deployment..."

# Set production environment
export NODE_ENV=production

# Create log directories
mkdir -p logs/backend logs/frontend logs/crewai

# Build the application
echo "📦 Building application..."
npm run build

# Start production services
echo "🌐 Starting production services..."

# Function to start CrewAI service
start_crewai() {
    echo "Starting CrewAI service on port 8000..."
    cd mycrewai
    python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --log-level info > ../logs/crewai/crewai-$(date '+%Y-%m-%d-%H-%M-%S').log 2>&1 &
    CREWAI_PID=$!
    cd ..
    echo "CrewAI started with PID: $CREWAI_PID"
}

# Function to start backend
start_backend() {
    echo "Starting backend server on port 80..."
    node dist/index.js > logs/backend/backend-$(date '+%Y-%m-%d-%H-%M-%S').log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"
}

# Cleanup function
cleanup() {
    echo "Shutting down services..."
    if [ ! -z "$CREWAI_PID" ]; then
        kill $CREWAI_PID 2>/dev/null
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    pkill -f "uvicorn api.main:app"
    pkill -f "node dist/index.js"
    exit 0
}

# Handle shutdown signals
trap cleanup SIGINT SIGTERM

# Start services
start_crewai
sleep 3
start_backend

echo "✅ All services started successfully!"
echo "📊 Backend logs: logs/backend/"
echo "🤖 CrewAI logs: logs/crewai/"
echo "🌐 Application URL: https://e7815a0a-ce92-4890-a01f-6a56e749ea2f-00-2vtvr5k0hy2v1.worf.replit.dev"

# Keep script running
wait