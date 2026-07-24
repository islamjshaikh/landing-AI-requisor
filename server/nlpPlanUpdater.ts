import { DatabaseStorage } from './database-storage';
import type { Task } from '@shared/schema';

const storage = new DatabaseStorage();

interface TaskUpdate {
  taskId?: number;
  name?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

interface NLPResult {
  success: boolean;
  message: string;
  updatedTasks?: Task[];
  error?: string;
}

/**
 * Natural Language Processing Task Updater
 * Parses natural language commands and updates tasks accordingly
 */
export class NLPTaskUpdater {
  
  /**
   * Main entry point for processing NLP commands
   */
  async processCommand(command: string, projectId: number): Promise<NLPResult> {
    const normalizedCommand = command.trim().toLowerCase();

    try {
      // Detect command type and execute
      if (this.isChangePriorityCommand(normalizedCommand)) {
        return await this.handleChangePriority(command, projectId);
      } else if (this.isSetDueDateCommand(normalizedCommand)) {
        return await this.handleSetDueDate(command, projectId);
      } else if (this.isRenameCommand(normalizedCommand)) {
        return await this.handleRename(command, projectId);
      } else if (this.isDeleteCommand(normalizedCommand)) {
        return await this.handleDelete(command, projectId);
      } else if (this.isAddCommand(normalizedCommand)) {
        return await this.handleAdd(command, projectId);
      } else if (this.isUpdateDescriptionCommand(normalizedCommand)) {
        return await this.handleUpdateDescription(command, projectId);
      } else {
        return {
          success: false,
          message: 'Command not recognized. Supported commands: change priority, set due date, rename, delete, add task, update description',
          error: 'UNKNOWN_COMMAND'
        };
      }
    } catch (error) {
      console.error('NLP command processing error:', error);
      return {
        success: false,
        message: 'Failed to process command',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  // ============= COMMAND DETECTION =============

  private isChangePriorityCommand(cmd: string): boolean {
    return /change\s+priority|set\s+priority|priority\s+to|priority\s+change/i.test(cmd);
  }

  private isSetDueDateCommand(cmd: string): boolean {
    return /set\s+due\s+date|due\s+date\s+to|due\s+on|deadline/i.test(cmd);
  }

  private isRenameCommand(cmd: string): boolean {
    return /rename|change\s+name|update\s+name/i.test(cmd);
  }

  private isDeleteCommand(cmd: string): boolean {
    return /delete\s+task|remove\s+task|delete\s+"[^"]+"|remove\s+"[^"]+"/i.test(cmd);
  }

  private isAddCommand(cmd: string): boolean {
    return /add\s+task|create\s+task|new\s+task/i.test(cmd);
  }

  private isUpdateDescriptionCommand(cmd: string): boolean {
    return /update\s+description|change\s+description|set\s+description/i.test(cmd);
  }

  // ============= TASK FINDING =============

  /**
   * Finds a task by exact or partial name match
   */
  private async findTaskByName(taskName: string, projectId: number): Promise<Task | null> {
    const tasks = await storage.getTasksByProjectId(projectId);
    
    // Try exact match first (case-insensitive)
    const exactMatch = tasks.find((t: Task) => 
      t.name.toLowerCase() === taskName.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Try partial match
    const partialMatch = tasks.find((t: Task) => 
      t.name.toLowerCase().includes(taskName.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // Try fuzzy match (task name contains most of the search terms)
    const searchTerms = taskName.toLowerCase().split(/\s+/);
    const fuzzyMatch = tasks.find((t: Task) => {
      const taskNameLower = t.name.toLowerCase();
      const matchCount = searchTerms.filter(term => taskNameLower.includes(term)).length;
      return matchCount >= searchTerms.length * 0.7; // 70% match threshold
    });

    return fuzzyMatch || null;
  }

  // ============= PARSING UTILITIES =============

  /**
   * Extracts text within quotes
   */
  private extractQuotedText(command: string): string | null {
    const match = command.match(/"([^"]+)"/);
    return match ? match[1] : null;
  }

  /**
   * Parses priority from command
   */
  private parsePriority(command: string): 'low' | 'medium' | 'high' | null {
    const cmd = command.toLowerCase();
    if (/\b(low|l)\b/.test(cmd)) return 'low';
    if (/\b(medium|med|m)\b/.test(cmd)) return 'medium';
    if (/\b(high|h)\b/.test(cmd)) return 'high';
    return null;
  }

  /**
   * Parses date from various formats
   */
  private parseDate(dateStr: string): string | null {
    try {
      // Format: "Nov 15, 2025" or "November 15, 2025"
      const monthDayYear = dateStr.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
      if (monthDayYear) {
        const [, month, day, year] = monthDayYear;
        const monthMap: Record<string, number> = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
          january: 0, february: 1, march: 2, april: 3, june: 5, july: 6,
          august: 7, september: 8, october: 9, november: 10, december: 11
        };
        const monthIndex = monthMap[month.toLowerCase()];
        if (monthIndex !== undefined) {
          const date = new Date(parseInt(year), monthIndex, parseInt(day));
          return date.toISOString().split('T')[0];
        }
      }

      // Format: "2025-11-15" (ISO format)
      const isoDate = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoDate) {
        return isoDate[0];
      }

      // Format: "11/15/2025" or "11-15-2025"
      const slashDate = dateStr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (slashDate) {
        const [, month, day, year] = slashDate;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toISOString().split('T')[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  // ============= COMMAND HANDLERS =============

  /**
   * Handles: "Task Name" change priority to low
   */
  private async handleChangePriority(command: string, projectId: number): Promise<NLPResult> {
    const taskName = this.extractQuotedText(command);
    if (!taskName) {
      return {
        success: false,
        message: 'Please specify task name in quotes, e.g., "Task Name" change priority to high',
        error: 'MISSING_TASK_NAME'
      };
    }

    const priority = this.parsePriority(command);
    if (!priority) {
      return {
        success: false,
        message: 'Please specify priority as low, medium, or high',
        error: 'INVALID_PRIORITY'
      };
    }

    const task = await this.findTaskByName(taskName, projectId);
    if (!task) {
      return {
        success: false,
        message: `Task "${taskName}" not found`,
        error: 'TASK_NOT_FOUND'
      };
    }

    const updatedTask = await storage.updateTask(task.id, { priority });
    
    return {
      success: true,
      message: `Updated "${task.name}" priority to ${priority}`,
      updatedTasks: [updatedTask]
    };
  }

  /**
   * Handles: Set "Conduct UAT" due date to Nov 15, 2025
   */
  private async handleSetDueDate(command: string, projectId: number): Promise<NLPResult> {
    const taskName = this.extractQuotedText(command);
    if (!taskName) {
      return {
        success: false,
        message: 'Please specify task name in quotes',
        error: 'MISSING_TASK_NAME'
      };
    }

    // Extract date portion after "to" or "on"
    const dateMatch = command.match(/(?:to|on)\s+(.+)$/i);
    if (!dateMatch) {
      return {
        success: false,
        message: 'Please specify due date, e.g., "due date to Nov 15, 2025"',
        error: 'MISSING_DUE_DATE'
      };
    }

    const dueDate = this.parseDate(dateMatch[1]);
    if (!dueDate) {
      return {
        success: false,
        message: 'Could not parse date. Use format: "Nov 15, 2025" or "2025-11-15"',
        error: 'INVALID_DATE_FORMAT'
      };
    }

    const task = await this.findTaskByName(taskName, projectId);
    if (!task) {
      return {
        success: false,
        message: `Task "${taskName}" not found`,
        error: 'TASK_NOT_FOUND'
      };
    }

    const updatedTask = await storage.updateTask(task.id, { dueDate });
    
    return {
      success: true,
      message: `Updated "${task.name}" due date to ${dueDate}`,
      updatedTasks: [updatedTask]
    };
  }

  /**
   * Handles: Rename "Develop Task" to "Implement Work Orders"
   */
  private async handleRename(command: string, projectId: number): Promise<NLPResult> {
    const matches = command.match(/"([^"]+)"\s+(?:to|as)\s+"([^"]+)"/i);
    if (!matches) {
      return {
        success: false,
        message: 'Use format: Rename "Old Name" to "New Name"',
        error: 'INVALID_RENAME_FORMAT'
      };
    }

    const [, oldName, newName] = matches;
    const task = await this.findTaskByName(oldName, projectId);
    if (!task) {
      return {
        success: false,
        message: `Task "${oldName}" not found`,
        error: 'TASK_NOT_FOUND'
      };
    }

    const updatedTask = await storage.updateTask(task.id, { name: newName });
    
    return {
      success: true,
      message: `Renamed "${oldName}" to "${newName}"`,
      updatedTasks: [updatedTask]
    };
  }

  /**
   * Handles: Delete task "Integrate with GPS"
   */
  private async handleDelete(command: string, projectId: number): Promise<NLPResult> {
    const taskName = this.extractQuotedText(command);
    if (!taskName) {
      return {
        success: false,
        message: 'Please specify task name in quotes, e.g., Delete task "Task Name"',
        error: 'MISSING_TASK_NAME'
      };
    }

    const task = await this.findTaskByName(taskName, projectId);
    if (!task) {
      return {
        success: false,
        message: `Task "${taskName}" not found`,
        error: 'TASK_NOT_FOUND'
      };
    }

    await storage.deleteTask(task.id);
    
    return {
      success: true,
      message: `Deleted task "${task.name}"`,
      updatedTasks: []
    };
  }

  /**
   * Handles: Add task "New Feature" due Nov 10, 2025 priority medium desc Add new API
   */
  private async handleAdd(command: string, projectId: number): Promise<NLPResult> {
    const taskName = this.extractQuotedText(command);
    if (!taskName) {
      return {
        success: false,
        message: 'Please specify task name in quotes',
        error: 'MISSING_TASK_NAME'
      };
    }

    // Extract due date
    const dueDateMatch = command.match(/due\s+(?:on\s+)?([a-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i);
    const dueDate = dueDateMatch ? this.parseDate(dueDateMatch[1]) : undefined;

    // Extract priority
    const priority = this.parsePriority(command) || 'medium';

    // Extract description
    const descMatch = command.match(/desc(?:ription)?\s+(.+?)(?:\s+(?:due|priority)|$)/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    const taskData: any = {
      projectId,
      name: taskName,
      status: 'todo',
      priority
    };
    
    if (description) taskData.description = description;
    if (dueDate) taskData.dueDate = dueDate;

    const newTask = await storage.createTask(taskData);

    return {
      success: true,
      message: `Added task "${taskName}"`,
      updatedTasks: [newTask]
    };
  }

  /**
   * Handles: Update description of "Task Name" to "New description text"
   */
  private async handleUpdateDescription(command: string, projectId: number): Promise<NLPResult> {
    const matches = command.match(/"([^"]+)"\s+(?:to|as)\s+"([^"]+)"/i);
    if (!matches) {
      const taskName = this.extractQuotedText(command);
      if (!taskName) {
        return {
          success: false,
          message: 'Use format: Update description of "Task Name" to "New description"',
          error: 'INVALID_FORMAT'
        };
      }

      // Extract description after "to"
      const descMatch = command.match(/to\s+(.+)$/i);
      if (!descMatch) {
        return {
          success: false,
          message: 'Please specify new description after "to"',
          error: 'MISSING_DESCRIPTION'
        };
      }

      const task = await this.findTaskByName(taskName, projectId);
      if (!task) {
        return {
          success: false,
          message: `Task "${taskName}" not found`,
          error: 'TASK_NOT_FOUND'
        };
      }

      const updatedTask = await storage.updateTask(task.id, { 
        description: descMatch[1].trim() 
      });

      return {
        success: true,
        message: `Updated description for "${task.name}"`,
        updatedTasks: [updatedTask]
      };
    }

    const [, taskName, newDescription] = matches;
    const task = await this.findTaskByName(taskName, projectId);
    if (!task) {
      return {
        success: false,
        message: `Task "${taskName}" not found`,
        error: 'TASK_NOT_FOUND'
      };
    }

    const updatedTask = await storage.updateTask(task.id, { description: newDescription });
    
    return {
      success: true,
      message: `Updated description for "${task.name}"`,
      updatedTasks: [updatedTask]
    };
  }
}

// Export singleton instance
export const nlpTaskUpdater = new NLPTaskUpdater();
