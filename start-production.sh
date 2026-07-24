#!/bin/bash

# Production startup script for Requisor
echo "🚀 Starting Requisor in production mode..."

# Create log directories
mkdir -p logs/backend logs/frontend logs/crewai

# Set production environment
export NODE_ENV=production
export PORT=5000

# Function to log with timestamp
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Start backend server
start_backend() {
    log_with_timestamp "Starting backend server on port $PORT"
    if [ -f "dist/index.js" ]; then
        node dist/index.js 2>&1 | tee -a logs/backend/backend-$(date '+%Y-%m-%d-%H-%M-%S').log
    else
        log_with_timestamp "Building application first..."
        npm run build
        node dist/index.js 2>&1 | tee -a logs/backend/backend-$(date '+%Y-%m-%d-%H-%M-%S').log
    fi
}

# Start CrewAI service on dedicated AI port
start_crewai() {
    log_with_timestamp "Starting CrewAI service on port 8000"
    uvicorn mycrewai.api.main:app --host 0.0.0.0 --port 8000 --log-level info 2>&1 | tee -a logs/crewai/crewai-$(date '+%Y-%m-%d-%H-%M-%S').log &
}

# Cleanup function
cleanup() {
    log_with_timestamp "Shutting down services..."
    pkill -f "uvicorn api.main:app"
    pkill -f "node dist/index.js"
    exit 0
}

# Handle shutdown signals
trap cleanup SIGINT SIGTERM

# Start services
start_crewai
sleep 5  # Give CrewAI time to start
start_backend

# Keep script running
wait