#!/usr/bin/env node

// Quick fix to restart both services properly
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Restarting services...');

// Kill existing processes
spawn('pkill', ['-f', 'tsx'], { stdio: 'inherit' });
spawn('pkill', ['-f', 'uvicorn'], { stdio: 'inherit' });

setTimeout(() => {
  console.log('Starting Express server...');
  const backend = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    cwd: __dirname
  });

  setTimeout(() => {
    console.log('Starting CrewAI service...');
    const crewai = spawn('uvicorn', ['mycrewai.api.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'], {
      stdio: 'inherit',
      cwd: __dirname,
      env: { ...process.env, PYTHONPATH: '.' }
    });
  }, 2000);
}, 1000);