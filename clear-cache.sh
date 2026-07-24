#!/bin/bash
# Cache clearing script for development
# Run this whenever UI changes aren't reflecting

echo "🧹 Clearing all caches and rebuilding..."

# Kill any running processes
echo "🛑 Stopping any running processes..."
pkill -f "tsx server" || true
pkill -f "node.*dev" || true

# Clear all cache directories
echo "🗑️ Removing cache directories..."
rm -rf node_modules/.cache
rm -rf dist
rm -rf .next
rm -rf .vite
rm -rf client/dist
rm -rf client/.vite

# Force rebuild
echo "🔨 Rebuilding application..."
npm run build

echo "✅ Cache cleared and application rebuilt!"
echo "🔄 Now restart your development server"
echo ""
echo "To use this script: chmod +x clear-cache.sh && ./clear-cache.sh"