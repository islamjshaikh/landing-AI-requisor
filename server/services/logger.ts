import fs from 'fs';
import path from 'path';

export class Logger {
  private baseDir: string;
  
  constructor(baseDir: string = './logs') {
    this.baseDir = baseDir;
    this.ensureLogDirectories();
  }

  private ensureLogDirectories() {
    const dirs = ['backend', 'frontend', 'crewai'];
    dirs.forEach(dir => {
      const fullPath = path.join(this.baseDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  private getLogFileName(service: 'backend' | 'frontend' | 'crewai'): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    return path.join(this.baseDir, service, `${service}-${dateStr}-${timeStr}.log`);
  }

  log(service: 'backend' | 'frontend' | 'crewai', level: 'info' | 'error' | 'warn', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = this.getLogFileName(service);
    
    // Append to log file
    fs.appendFileSync(logFile, logLine);
    
    // Also log to console for development
    console.log(`[${service.toUpperCase()}] ${level.toUpperCase()}: ${message}`, data || '');
  }

  info(service: 'backend' | 'frontend' | 'crewai', message: string, data?: any) {
    this.log(service, 'info', message, data);
  }

  error(service: 'backend' | 'frontend' | 'crewai', message: string, data?: any) {
    this.log(service, 'error', message, data);
  }

  warn(service: 'backend' | 'frontend' | 'crewai', message: string, data?: any) {
    this.log(service, 'warn', message, data);
  }
}

export const logger = new Logger();