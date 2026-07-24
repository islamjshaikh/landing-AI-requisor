/**
 * In-Memory Logging Service for Production Debugging
 * Captures all logs and serves them via API endpoints
 */

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  service: 'CREWAI' | 'PRODUCTION' | 'NODE' | 'HEALTH' | 'SYSTEM';
  message: string;
  data?: any;
}

class LogService {
  private logs: LogEntry[] = [];
  private maxLogs = 5000; // Keep last 5000 logs to prevent memory issues

  constructor() {
    // Add startup log
    this.log('SYSTEM', 'INFO', 'LogService initialized - capturing all application logs');
  }

  log(service: LogEntry['service'], level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      data
    };

    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to console for development
    const consoleMessage = `[${entry.timestamp}] [${entry.service}] ${entry.level}: ${entry.message}`;
    if (data) {
      console.log(consoleMessage, data);
    } else {
      console.log(consoleMessage);
    }
  }

  // Get all logs
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Get logs by service
  getLogsByService(service: LogEntry['service']): LogEntry[] {
    return this.logs.filter(log => log.service === service);
  }

  // Get logs by level
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Get recent logs (last N entries)
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Get logs within time range
  getLogsByTimeRange(startTime: string, endTime?: string): LogEntry[] {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    
    return this.logs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime >= start && logTime <= end;
    });
  }

  // Get error logs only
  getErrorLogs(): LogEntry[] {
    return this.logs.filter(log => log.level === 'ERROR');
  }

  // Search logs by message content
  searchLogs(query: string): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(log => 
      log.message.toLowerCase().includes(lowerQuery) ||
      (log.data && JSON.stringify(log.data).toLowerCase().includes(lowerQuery))
    );
  }

  // Get log statistics
  getLogStats() {
    const stats = {
      total: this.logs.length,
      byService: {} as Record<string, number>,
      byLevel: {} as Record<string, number>,
      lastUpdate: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
      timeRange: {
        oldest: this.logs.length > 0 ? this.logs[0].timestamp : null,
        newest: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null
      }
    };

    // Count by service
    this.logs.forEach(log => {
      stats.byService[log.service] = (stats.byService[log.service] || 0) + 1;
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    });

    return stats;
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    this.log('SYSTEM', 'INFO', 'All logs cleared');
  }
}

// Export singleton instance
export const logService = new LogService();

// Convenience methods for different services
export const logCrewAI = (level: LogEntry['level'], message: string, data?: any) => {
  logService.log('CREWAI', level, message, data);
};

export const logProduction = (level: LogEntry['level'], message: string, data?: any) => {
  logService.log('PRODUCTION', level, message, data);
};

export const logHealth = (level: LogEntry['level'], message: string, data?: any) => {
  logService.log('HEALTH', level, message, data);
};

export const logNode = (level: LogEntry['level'], message: string, data?: any) => {
  logService.log('NODE', level, message, data);
};