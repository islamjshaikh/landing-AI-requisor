/**
 * API Routes for accessing logs via HTTP endpoints
 * Provides comprehensive logging access for production debugging
 */

import express from 'express';
import { logService } from '../services/log-service';

const router = express.Router();

// Get all logs
router.get('/all', (req, res) => {
  try {
    const logs = logService.getAllLogs();
    res.json({
      success: true,
      count: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent logs (default 100, max 1000)
router.get('/recent', (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 100, 1000);
    const logs = logService.getRecentLogs(count);
    res.json({
      success: true,
      count: logs.length,
      requestedCount: count,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent logs'
    });
  }
});

// Get logs by service
router.get('/service/:serviceName', (req, res) => {
  try {
    const serviceName = req.params.serviceName.toUpperCase();
    const validServices = ['CREWAI', 'PRODUCTION', 'NODE', 'HEALTH', 'SYSTEM'];
    
    if (!validServices.includes(serviceName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service name',
        validServices: validServices
      });
    }

    const logs = logService.getLogsByService(serviceName as any);
    res.json({
      success: true,
      service: serviceName,
      count: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve service logs'
    });
  }
});

// Get CrewAI logs specifically
router.get('/crewai', (req, res) => {
  try {
    const logs = logService.getLogsByService('CREWAI');
    res.json({
      success: true,
      service: 'CrewAI',
      count: logs.length,
      logs: logs,
      latestActivity: logs.length > 0 ? logs[logs.length - 1].timestamp : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve CrewAI logs'
    });
  }
});

// Get production logs specifically
router.get('/production', (req, res) => {
  try {
    const logs = logService.getLogsByService('PRODUCTION');
    res.json({
      success: true,
      service: 'Production',
      count: logs.length,
      logs: logs,
      latestActivity: logs.length > 0 ? logs[logs.length - 1].timestamp : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve production logs'
    });
  }
});

// Get error logs only
router.get('/errors', (req, res) => {
  try {
    const logs = logService.getErrorLogs();
    res.json({
      success: true,
      level: 'ERROR',
      count: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error logs'
    });
  }
});

// Get logs by level
router.get('/level/:level', (req, res) => {
  try {
    const level = req.params.level.toUpperCase();
    const validLevels = ['INFO', 'ERROR', 'WARN', 'DEBUG'];
    
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid log level',
        validLevels: validLevels
      });
    }

    const logs = logService.getLogsByLevel(level as any);
    res.json({
      success: true,
      level: level,
      count: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs by level'
    });
  }
});

// Search logs
router.get('/search', (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const logs = logService.searchLogs(query);
    res.json({
      success: true,
      query: query,
      count: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search logs'
    });
  }
});

// Get log statistics
router.get('/stats', (req, res) => {
  try {
    const stats = logService.getLogStats();
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve log statistics'
    });
  }
});

// Get logs within time range
router.get('/timerange', (req, res) => {
  try {
    const startTime = req.query.start as string;
    const endTime = req.query.end as string;
    
    if (!startTime) {
      return res.status(400).json({
        success: false,
        error: 'Start time parameter "start" is required (ISO format)'
      });
    }

    const logs = logService.getLogsByTimeRange(startTime, endTime);
    res.json({
      success: true,
      timeRange: {
        start: startTime,
        end: endTime || 'now'
      },
      count: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs by time range'
    });
  }
});

// Health check status
router.get('/health', (req, res) => {
  try {
    const healthLogs = logService.getLogsByService('HEALTH');
    const crewaiLogs = logService.getLogsByService('CREWAI');
    const recentHealthLogs = healthLogs.slice(-10); // Last 10 health logs
    const recentCrewAILogs = crewaiLogs.slice(-5);  // Last 5 CrewAI logs
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      healthStatus: {
        totalHealthLogs: healthLogs.length,
        totalCrewAILogs: crewaiLogs.length,
        recentHealthActivity: recentHealthLogs,
        recentCrewAIActivity: recentCrewAILogs,
        lastHealthCheck: healthLogs.length > 0 ? healthLogs[healthLogs.length - 1].timestamp : null,
        lastCrewAIActivity: crewaiLogs.length > 0 ? crewaiLogs[crewaiLogs.length - 1].timestamp : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health status'
    });
  }
});

// Clear logs (admin endpoint)
router.delete('/clear', (req, res) => {
  try {
    logService.clearLogs();
    res.json({
      success: true,
      message: 'All logs cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs'
    });
  }
});

// Stream logs (text format for easy reading)
router.get('/stream', (req, res) => {
  try {
    const service = req.query.service as string;
    const level = req.query.level as string;
    const count = Math.min(parseInt(req.query.count as string) || 100, 1000);
    
    let logs = logService.getRecentLogs(count);
    
    // Filter by service if specified
    if (service) {
      logs = logs.filter(log => log.service.toLowerCase() === service.toLowerCase());
    }
    
    // Filter by level if specified
    if (level) {
      logs = logs.filter(log => log.level.toLowerCase() === level.toLowerCase());
    }
    
    // Format as readable text
    const formattedLogs = logs.map(log => {
      const dataStr = log.data ? ` | Data: ${JSON.stringify(log.data)}` : '';
      return `[${log.timestamp}] [${log.service}] ${log.level}: ${log.message}${dataStr}`;
    }).join('\n');
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(formattedLogs);
  } catch (error) {
    res.status(500).send('Failed to stream logs');
  }
});

export default router;