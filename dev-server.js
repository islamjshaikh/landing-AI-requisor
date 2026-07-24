#!/usr/bin/env node

// Simple development server starter that doesn't require tsx
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[dev-server] Starting development servers...');

// Start the backend with npx tsx
const backend = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Start the CrewAI service
const crewai = spawn('uvicorn', ['mycrewai.api.main:app', '--host', '0.0.0.0', '--port', '8001', '--reload'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, PYTHONPATH: '.' }
});

console.log('[dev-server] Backend started on port 5000');
console.log('[dev-server] CrewAI started on port 8001');

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n[dev-server] Shutting down...');
  backend.kill();
  crewai.kill();
  process.exit(0);
});

// Monitor processes
backend.on('exit', (code) => {
  console.log(`[dev-server] Backend exited with code ${code}`);
  crewai.kill();
  process.exit(code);
});

crewai.on('exit', (code) => {
  console.log(`[dev-server] CrewAI exited with code ${code}`);
  backend.kill();
  process.exit(code);
});