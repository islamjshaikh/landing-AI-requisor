#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Requisor for deployment...');

// Set production environment
process.env.NODE_ENV = 'production';

try {
  // Build frontend
  console.log('📦 Building frontend...');
  execSync('npm run build', { stdio: 'inherit' });

  // Create deployment structure
  console.log('📁 Creating deployment structure...');
  
  // Ensure log directories exist
  ['logs/backend', 'logs/frontend', 'logs/crewai'].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  // Create production start script
  const startScript = `#!/bin/bash
export NODE_ENV=production
export PORT=80

echo "🚀 Starting Requisor in production mode..."

# Start CrewAI service
cd mycrewai
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --log-level info &
CREWAI_PID=$!
cd ..

# Start backend
node dist/index.js &
BACKEND_PID=$!

echo "✅ Services started:"
echo "🤖 CrewAI: PID $CREWAI_PID"
echo "🖥️ Backend: PID $BACKEND_PID"

# Cleanup on exit
cleanup() {
  echo "Shutting down services..."
  kill $CREWAI_PID $BACKEND_PID 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM
wait
`;

  fs.writeFileSync('start-production.sh', startScript);
  execSync('chmod +x start-production.sh');

  console.log('✅ Build completed successfully!');
  console.log('📝 Deployment files created:');
  console.log('   - dist/ (built application)');
  console.log('   - logs/ (log directories)');
  console.log('   - start-production.sh (production startup script)');
  console.log('');
  console.log('🚀 Ready for deployment! Run: ./start-production.sh');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}