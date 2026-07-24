#!/bin/bash
echo "🧹 Clearing all caches and rebuilding..."

# Kill processes
killall node 2>/dev/null || true

# Remove caches
rm -rf node_modules/.cache .vite dist client/dist client/build server/dist .next client/.next /tmp/.vite* /tmp/node* ~/.npm ~/.cache 2>/dev/null || true

# Force rebuild
echo "🔨 Force rebuilding frontend..."
cd client && npm run build --force && cd ..

# Add timestamp to prevent browser caching
echo "BUILD_TIMESTAMP=$(date +%s)" > .env.local

echo "✅ Cache clearing complete! New build ready."
echo "📱 Clear your browser cache with Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
