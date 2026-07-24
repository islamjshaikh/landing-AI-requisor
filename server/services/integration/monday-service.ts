import axios from 'axios';
import querystring from 'querystring';
import { IntegrationProvider } from '@shared/integrations';
import { BaseIntegrationService, ProjectData, SyncResult, TaskData } from './base-integration';
import { storage } from '../../storage';
import { config } from '../../config/environment';

// Monday.com API Constants - now configurable via environment
const MONDAY_API_URL = config.oauth.monday.apiUrl;
const MONDAY_AUTH_URL = config.oauth.monday.authUrl;
const MONDAY_TOKEN_URL = config.oauth.monday.tokenUrl;

// You'll need to set these environment variables
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET;

export class MondayService extends BaseIntegrationService {
  constructor(userId: string) {
    super(userId, IntegrationProvider.MONDAY);
  }

  /**
   * Get the OAuth URL for Monday.com
   */
  getAuthUrl(): string {
    if (!MONDAY_CLIENT_ID) {
      throw new Error('MONDAY_CLIENT_ID environment variable is not set');
    }

    const params = {
      client_id: MONDAY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${config.urls.backend}/api/integrations/oauth/monday`,
      state: this.userId, // Store user ID in state for callback verification
    };

    return `${MONDAY_AUTH_URL}?${querystring.stringify(params)}`;
  }

  /**
   * Handle the OAuth callback from Monday.com
   */
  async handleOAuthCallback(code: string, redirectUri: string): Promise<boolean> {
    try {
      if (!MONDAY_CLIENT_ID || !MONDAY_CLIENT_SECRET) {
        throw new Error('Monday.com client credentials are not configured');
      }

      // Exchange authorization code for access token
      const tokenResponse = await axios.post(
        MONDAY_TOKEN_URL,
        {
          code,
          client_id: MONDAY_CLIENT_ID,
          client_secret: MONDAY_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const { access_token } = tokenResponse.data;

      // Monday.com doesn't provide refresh tokens or token expiry, so we just set it to 1 year
      const tokenExpiry = new Date();
      tokenExpiry.setFullYear(tokenExpiry.getFullYear() + 1);

      // Check if integration exists
      let integration = await storage.getIntegrationByProvider(this.userId, IntegrationProvider.MONDAY);

      if (integration) {
        // Update existing integration
        integration = await storage.updateIntegration(integration.id, {
          accessToken: access_token,
          tokenExpiry,
          isConnected: true,
          lastSynced: new Date(),
        });
      } else {
        // Create new integration
        integration = await storage.createIntegration({
          userId: this.userId,
          provider: IntegrationProvider.MONDAY,
          accessToken: access_token,
          tokenExpiry,
          isConnected: true,
        });
      }

      // Fetch and store workspaces and boards
      await this.getWorkspaces();
      
      this.integration = integration;
      return true;
    } catch (error) {
      console.error('Error handling Monday.com OAuth callback:', error);
      return false;
    }
  }

  /**
   * Get workspaces from Monday.com
   */
  async getWorkspaces(): Promise<{ id: string; name: string }[]> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return [];
    }

    try {
      // Monday.com calls workspaces "teams"
      const query = `
        query {
          teams {
            id
            name
          }
        }
      `;

      const response = await axios.post(
        MONDAY_API_URL,
        { query },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const workspaces = response.data.data.teams.map((team: any) => ({
        id: team.id.toString(),
        name: team.name,
      }));

      // Also get the boards
      await this.getBoards();

      // Save workspaces to integration data
      const additionalData = this.integration.additionalData || {};
      await this.updateIntegration({
        additionalData: {
          ...additionalData,
          workspaces,
        },
      });

      return workspaces;
    } catch (error) {
      console.error('Error fetching Monday.com workspaces:', error);
      return [];
    }
  }

  /**
   * Get boards from Monday.com
   */
  async getBoards(): Promise<{ id: string; name: string }[]> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return [];
    }

    try {
      const query = `
        query {
          boards {
            id
            name
            description
          }
        }
      `;

      const response = await axios.post(
        MONDAY_API_URL,
        { query },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const boards = response.data.data.boards.map((board: any) => ({
        id: board.id.toString(),
        name: board.name,
        description: board.description,
      }));

      // Save boards to integration data
      const additionalData = this.integration.additionalData || {};
      await this.updateIntegration({
        additionalData: {
          ...additionalData,
          boards,
        },
      });

      return boards;
    } catch (error) {
      console.error('Error fetching Monday.com boards:', error);
      return [];
    }
  }

  /**
   * Get board columns from Monday.com
   */
  async getBoardColumns(boardId: string): Promise<{ id: string; title: string; type: string }[]> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return [];
    }

    try {
      const query = `
        query {
          boards(ids: ${boardId}) {
            columns {
              id
              title
              type
            }
          }
        }
      `;

      const response = await axios.post(
        MONDAY_API_URL,
        { query },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const columns = response.data.data.boards[0].columns.map((column: any) => ({
        id: column.id,
        title: column.title,
        type: column.type,
      }));

      // Save columns to integration data
      const additionalData = this.integration.additionalData || {};
      await this.updateIntegration({
        additionalData: {
          ...additionalData,
          columns,
        },
      });

      return columns;
    } catch (error) {
      console.error('Error fetching Monday.com board columns:', error);
      return [];
    }
  }

  /**
   * Pull projects from Monday.com (treats boards as projects)
   */
  async pullProjects(): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Monday.com',
      };
    }

    try {
      // Get all boards
      const boards = await this.getBoards();
      
      // Format boards as projects
      const projects = boards.map(board => ({
        name: board.name,
        description: board.description || `Imported from Monday.com - ${board.name}`,
        externalId: board.id,
        source: 'monday',
        ownerId: this.userId,
      }));

      return {
        success: true,
        message: `Successfully pulled ${projects.length} projects from Monday.com`,
        data: projects,
      };
    } catch (error) {
      console.error('Error pulling projects from Monday.com:', error);
      return {
        success: false,
        message: 'Failed to pull projects from Monday.com',
        errors: [error],
      };
    }
  }

  /**
   * Push a project to Monday.com (creates a new board)
   */
  async pushProject(project: ProjectData): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Monday.com',
      };
    }

    try {
      // Get workspace ID from integration data or use default
      const additionalData = this.integration.additionalData || {};
      const workspaces = additionalData.workspaces || [];
      
      // Default to first workspace if none specified
      const workspaceId = this.integration.workspaceId || (workspaces.length > 0 ? workspaces[0].id : null);
      
      if (!workspaceId) {
        return {
          success: false,
          message: 'No Monday.com workspace found. Please sync workspaces first.',
        };
      }

      // Create a new board
      const boardTemplate = "blank"; // Use blank template
      const boardType = "public"; // Public board
      
      const query = `
        mutation {
          create_board(board_name: "${project.name}", board_kind: ${boardType}, template_id: ${boardTemplate}) {
            id
            name
          }
        }
      `;

      const response = await axios.post(
        MONDAY_API_URL,
        { query },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const board = response.data.data.create_board;

      // Create default columns for tasks
      await this.createDefaultColumns(board.id);

      return {
        success: true,
        message: 'Successfully created board in Monday.com',
        data: {
          externalId: board.id.toString(),
          name: board.name,
        },
      };
    } catch (error) {
      console.error('Error pushing project to Monday.com:', error);
      return {
        success: false,
        message: 'Failed to create board in Monday.com',
        errors: [error],
      };
    }
  }

  /**
   * Create default columns for a new board
   */
  private async createDefaultColumns(boardId: string): Promise<void> {
    const columns = [
      { title: "Status", type: "status" },
      { title: "Due Date", type: "date" },
      { title: "Priority", type: "dropdown" },
      { title: "Description", type: "long-text" },
    ];

    for (const column of columns) {
      const query = `
        mutation {
          create_column(board_id: ${boardId}, title: "${column.title}", column_type: ${column.type}) {
            id
          }
        }
      `;

      await axios.post(
        MONDAY_API_URL,
        { query },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }

  /**
   * Pull tasks from a Monday.com board
   */
  async pullTasks(projectId: number, externalBoardId?: string): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Monday.com',
      };
    }

    if (!externalBoardId) {
      // Try to get the external ID from the project
      const project = await storage.getProject(projectId);
      if (!project || !project.externalId) {
        return {
          success: false,
          message: 'No external board ID provided or found in project',
        };
      }
      externalBoardId = project.externalId;
    }

    try {
      // Get columns for this board
      const columns = await this.getBoardColumns(externalBoardId);
      
      // Find the indexes of important columns
      const statusColumn = columns.find(c => c.title.toLowerCase().includes('status') || c.type === 'status');
      const dueDateColumn = columns.find(c => c.title.toLowerCase().includes('due') || c.type === 'date');
      const priorityColumn = columns.find(c => c.title.toLowerCase().includes('priority') || c.type === 'dropdown');
      const descriptionColumn = columns.find(c => c.title.toLowerCase().includes('description') || c.type === 'long-text');

      // Get items (tasks) from the board
      const query = `
        query {
          boards(ids: ${externalBoardId}) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      `;

      const response = await axios.post(
        MONDAY_API_URL,
        { query },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Process items into tasks
      const items = response.data.data.boards[0].items;
      const tasks = [];

      for (const item of items) {
        const task: Record<string, any> = {
          name: item.name,
          description: '',
          status: 'todo',
          projectId,
          source: 'monday',
          externalId: item.id.toString(),
          sourceData: {
            columnValues: {},
          },
        };

        // Process column values
        for (const columnValue of item.column_values) {
          task.sourceData.columnValues[columnValue.id] = columnValue.value;
          
          // Map to our task fields
          if (statusColumn && columnValue.id === statusColumn.id) {
            if (columnValue.text) {
              // Map status based on text value
              if (columnValue.text.toLowerCase().includes('done') || 
                  columnValue.text.toLowerCase().includes('complete')) {
                task.status = 'done';
                task.isCompleted = true;
              } else if (columnValue.text.toLowerCase().includes('progress') || 
                         columnValue.text.toLowerCase().includes('working')) {
                task.status = 'in-progress';
              }
            }
          } else if (dueDateColumn && columnValue.id === dueDateColumn.id) {
            if (columnValue.text) {
              task.dueDate = new Date(columnValue.text);
            }
          } else if (priorityColumn && columnValue.id === priorityColumn.id) {
            if (columnValue.text) {
              if (columnValue.text.toLowerCase().includes('high')) {
                task.priority = 'high';
              } else if (columnValue.text.toLowerCase().includes('low')) {
                task.priority = 'low';
              } else {
                task.priority = 'medium';
              }
            }
          } else if (descriptionColumn && columnValue.id === descriptionColumn.id) {
            task.description = columnValue.text || '';
          }
        }

        tasks.push(task);
      }

      return {
        success: true,
        message: `Successfully pulled ${tasks.length} tasks from Monday.com`,
        data: tasks,
      };
    } catch (error) {
      console.error('Error pulling tasks from Monday.com:', error);
      return {
        success: false,
        message: 'Failed to pull tasks from Monday.com',
        errors: [error],
      };
    }
  }

  /**
   * Push a task to Monday.com
   */
  async pushTask(task: TaskData): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Monday.com',
      };
    }

    try {
      // Get the project to find its external ID (board ID)
      const project = await storage.getProject(task.projectId);
      if (!project || !project.externalId) {
        return {
          success: false,
          message: 'Project has no external Monday.com ID',
        };
      }

      const boardId = project.externalId;

      // Get columns for this board
      const columns = await this.getBoardColumns(boardId);
      
      // Find the important columns
      const statusColumn = columns.find(c => c.title.toLowerCase().includes('status') || c.type === 'status');
      const dueDateColumn = columns.find(c => c.title.toLowerCase().includes('due') || c.type === 'date');
      const priorityColumn = columns.find(c => c.title.toLowerCase().includes('priority') || c.type === 'dropdown');
      const descriptionColumn = columns.find(c => c.title.toLowerCase().includes('description') || c.type === 'long-text');

      // Create or update item in Monday.com
      if (task.externalId) {
        // Update existing item
        // We need to update each column individually
        
        // Update name
        const updateNameQuery = `
          mutation {
            change_multiple_column_values(item_id: ${task.externalId}, board_id: ${boardId}, column_values: "{\\"name\\":\\"${task.name}\\"}") {
              id
            }
          }
        `;
        
        await axios.post(
          MONDAY_API_URL,
          { query: updateNameQuery },
          {
            headers: {
              Authorization: `Bearer ${this.integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        // Build column values JSON
        const columnValues: Record<string, any> = {};
        
        // Add status
        if (statusColumn) {
          let statusValue = "To Do";
          if (task.status === 'done') {
            statusValue = "Done";
          } else if (task.status === 'in-progress') {
            statusValue = "In Progress";
          }
          columnValues[statusColumn.id] = statusValue;
        }
        
        // Add due date
        if (dueDateColumn && task.dueDate) {
          const date = new Date(task.dueDate);
          columnValues[dueDateColumn.id] = date.toISOString().split('T')[0];
        }
        
        // Add priority
        if (priorityColumn) {
          let priorityValue = "Medium";
          if (task.priority === 'high') {
            priorityValue = "High";
          } else if (task.priority === 'low') {
            priorityValue = "Low";
          }
          columnValues[priorityColumn.id] = priorityValue;
        }
        
        // Add description
        if (descriptionColumn && task.description) {
          columnValues[descriptionColumn.id] = task.description;
        }
        
        // Update other columns
        const updateColumnsQuery = `
          mutation {
            change_multiple_column_values(item_id: ${task.externalId}, board_id: ${boardId}, column_values: ${JSON.stringify(JSON.stringify(columnValues))}) {
              id
            }
          }
        `;
        
        await axios.post(
          MONDAY_API_URL,
          { query: updateColumnsQuery },
          {
            headers: {
              Authorization: `Bearer ${this.integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          success: true,
          message: 'Successfully updated task in Monday.com',
          data: {
            externalId: task.externalId,
          },
        };
      } else {
        // Create new item
        const createItemQuery = `
          mutation {
            create_item(board_id: ${boardId}, item_name: "${task.name}") {
              id
            }
          }
        `;
        
        const response = await axios.post(
          MONDAY_API_URL,
          { query: createItemQuery },
          {
            headers: {
              Authorization: `Bearer ${this.integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const itemId = response.data.data.create_item.id;
        
        // Update columns for the new item
        const columnValues: Record<string, any> = {};
        
        // Add status
        if (statusColumn) {
          let statusValue = "To Do";
          if (task.status === 'done') {
            statusValue = "Done";
          } else if (task.status === 'in-progress') {
            statusValue = "In Progress";
          }
          columnValues[statusColumn.id] = statusValue;
        }
        
        // Add due date
        if (dueDateColumn && task.dueDate) {
          const date = new Date(task.dueDate);
          columnValues[dueDateColumn.id] = date.toISOString().split('T')[0];
        }
        
        // Add priority
        if (priorityColumn) {
          let priorityValue = "Medium";
          if (task.priority === 'high') {
            priorityValue = "High";
          } else if (task.priority === 'low') {
            priorityValue = "Low";
          }
          columnValues[priorityColumn.id] = priorityValue;
        }
        
        // Add description
        if (descriptionColumn && task.description) {
          columnValues[descriptionColumn.id] = task.description;
        }
        
        // Update columns
        const updateColumnsQuery = `
          mutation {
            change_multiple_column_values(item_id: ${itemId}, board_id: ${boardId}, column_values: ${JSON.stringify(JSON.stringify(columnValues))}) {
              id
            }
          }
        `;
        
        await axios.post(
          MONDAY_API_URL,
          { query: updateColumnsQuery },
          {
            headers: {
              Authorization: `Bearer ${this.integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          success: true,
          message: 'Successfully created task in Monday.com',
          data: {
            externalId: itemId,
          },
        };
      }
    } catch (error) {
      console.error('Error pushing task to Monday.com:', error);
      return {
        success: false,
        message: 'Failed to push task to Monday.com',
        errors: [error],
      };
    }
  }

  /**
   * Refresh the access token if needed
   */
  protected async refreshTokenIfNeeded(): Promise<boolean> {
    // Monday.com tokens don't expire, so we just return true
    return true;
  }
}