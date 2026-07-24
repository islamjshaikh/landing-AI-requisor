import axios from 'axios';
import querystring from 'querystring';
import { IntegrationProvider } from '@shared/integrations';
import { BaseIntegrationService, ProjectData, SyncResult, TaskData } from './base-integration';
import { storage } from '../../storage';
import { config } from '../../config/environment';

// Smartsheet API Constants - now configurable via environment
const SMARTSHEET_API_URL = config.oauth.smartsheet.apiUrl;
const SMARTSHEET_AUTH_URL = config.oauth.smartsheet.authUrl;
const SMARTSHEET_TOKEN_URL = config.oauth.smartsheet.tokenUrl;

// You'll need to set these environment variables
const SMARTSHEET_CLIENT_ID = process.env.SMARTSHEET_CLIENT_ID;
const SMARTSHEET_CLIENT_SECRET = process.env.SMARTSHEET_CLIENT_SECRET;

export class SmartsheetService extends BaseIntegrationService {
  constructor(userId: string) {
    super(userId, IntegrationProvider.SMARTSHEET);
  }

  /**
   * Get the OAuth URL for Smartsheet
   */
  getAuthUrl(): string {
    if (!SMARTSHEET_CLIENT_ID) {
      throw new Error('SMARTSHEET_CLIENT_ID environment variable is not set');
    }

    const params = {
      response_type: 'code',
      client_id: SMARTSHEET_CLIENT_ID,
      scope: 'READ_SHEETS,WRITE_SHEETS,READ_USERS',
      state: this.userId, // Store user ID in state for callback verification
    };

    return `${SMARTSHEET_AUTH_URL}?${querystring.stringify(params)}`;
  }

  /**
   * Handle the OAuth callback from Smartsheet
   */
  async handleOAuthCallback(code: string, redirectUri: string): Promise<boolean> {
    try {
      if (!SMARTSHEET_CLIENT_ID || !SMARTSHEET_CLIENT_SECRET) {
        throw new Error('Smartsheet client credentials are not configured');
      }

      // Exchange authorization code for access token
      const tokenResponse = await axios.post(
        SMARTSHEET_TOKEN_URL,
        {
          grant_type: 'authorization_code',
          code,
          client_id: SMARTSHEET_CLIENT_ID,
          client_secret: SMARTSHEET_CLIENT_SECRET,
          redirect_uri: redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Calculate token expiry date
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + expires_in);

      // Check if integration exists
      let integration = await storage.getIntegrationByProvider(this.userId, IntegrationProvider.SMARTSHEET);

      if (integration) {
        // Update existing integration
        integration = await storage.updateIntegration(integration.id, {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiry,
          isConnected: true,
          lastSynced: new Date(),
        });
      } else {
        // Create new integration
        integration = await storage.createIntegration({
          userId: this.userId,
          provider: IntegrationProvider.SMARTSHEET,
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiry,
          isConnected: true,
        });
      }

      this.integration = integration;
      return true;
    } catch (error) {
      console.error('Error handling Smartsheet OAuth callback:', error);
      return false;
    }
  }

  /**
   * Get workspaces from Smartsheet
   */
  async getWorkspaces(): Promise<{ id: string; name: string }[]> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return [];
    }

    try {
      // Get all workspaces (folders in Smartsheet)
      const response = await axios.get(`${SMARTSHEET_API_URL}/workspaces`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
        },
      });

      const workspaces = response.data.data.map((workspace: any) => ({
        id: workspace.id.toString(),
        name: workspace.name,
      }));

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
      console.error('Error fetching Smartsheet workspaces:', error);
      return [];
    }
  }

  /**
   * Get sheets from Smartsheet
   */
  async getSheets(): Promise<{ id: string; name: string; url?: string }[]> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return [];
    }

    try {
      // Get all sheets
      const response = await axios.get(`${SMARTSHEET_API_URL}/sheets`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
        },
      });

      const sheets = response.data.data.map((sheet: any) => ({
        id: sheet.id.toString(),
        name: sheet.name,
        url: sheet.permalink,
      }));

      // Save sheets to integration data
      const additionalData = this.integration.additionalData || {};
      await this.updateIntegration({
        additionalData: {
          ...additionalData,
          sheets,
        },
      });

      return sheets;
    } catch (error) {
      console.error('Error fetching Smartsheet sheets:', error);
      return [];
    }
  }

  /**
   * Pull projects from Smartsheet (treats sheets as projects)
   */
  async pullProjects(): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Smartsheet',
      };
    }

    try {
      const sheets = await this.getSheets();
      
      // Process each sheet as a project
      const projects = [];
      for (const sheet of sheets) {
        // Get sheet details
        const response = await axios.get(`${SMARTSHEET_API_URL}/sheets/${sheet.id}`, {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
          },
        });

        const sheetData = response.data;
        
        // Create project from sheet
        const project = {
          name: sheetData.name,
          description: `Imported from Smartsheet - ${sheetData.name}`,
          externalId: sheetData.id.toString(),
          source: 'smartsheet',
          sourceData: {
            sheetUrl: sheetData.permalink,
            columns: sheetData.columns.map((col: any) => ({
              id: col.id,
              title: col.title,
              type: col.type,
            })),
          },
          ownerId: this.userId,
        };
        
        projects.push(project);
      }

      return {
        success: true,
        message: `Successfully pulled ${projects.length} projects from Smartsheet`,
        data: projects,
      };
    } catch (error) {
      console.error('Error pulling projects from Smartsheet:', error);
      return {
        success: false,
        message: 'Failed to pull projects from Smartsheet',
        errors: [error],
      };
    }
  }

  /**
   * Push a project to Smartsheet (creates a new sheet)
   */
  async pushProject(project: ProjectData): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Smartsheet',
      };
    }

    try {
      // Create a new sheet in Smartsheet
      const response = await axios.post(
        `${SMARTSHEET_API_URL}/sheets`,
        {
          name: project.name,
          columns: [
            {
              title: 'Task Name',
              type: 'TEXT_NUMBER',
              primary: true,
            },
            {
              title: 'Description',
              type: 'TEXT_NUMBER',
            },
            {
              title: 'Status',
              type: 'TEXT_NUMBER',
              options: ['To Do', 'In Progress', 'Done'],
            },
            {
              title: 'Due Date',
              type: 'DATE',
            },
            {
              title: 'Priority',
              type: 'TEXT_NUMBER',
              options: ['Low', 'Medium', 'High'],
            },
            {
              title: 'Assignee',
              type: 'CONTACT_LIST',
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const sheetId = response.data.result.id;

      return {
        success: true,
        message: 'Successfully created sheet in Smartsheet',
        data: {
          externalId: sheetId.toString(),
          url: response.data.result.permalink,
        },
      };
    } catch (error) {
      console.error('Error pushing project to Smartsheet:', error);
      return {
        success: false,
        message: 'Failed to create sheet in Smartsheet',
        errors: [error],
      };
    }
  }

  /**
   * Pull tasks from a Smartsheet sheet
   */
  async pullTasks(projectId: number, externalSheetId?: string): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Smartsheet',
      };
    }

    if (!externalSheetId) {
      // Try to get the external ID from the project
      const project = await storage.getProject(projectId);
      if (!project || !project.externalId) {
        return {
          success: false,
          message: 'No external sheet ID provided or found in project',
        };
      }
      externalSheetId = project.externalId;
    }

    try {
      // Get sheet data with rows
      const response = await axios.get(`${SMARTSHEET_API_URL}/sheets/${externalSheetId}`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
        },
        params: {
          include: 'rowPermalinks',
        },
      });

      const sheetData = response.data;
      
      // Map column IDs to their names for easier access
      const columnMap = new Map();
      sheetData.columns.forEach((col: any) => {
        columnMap.set(col.id, {
          title: col.title,
          index: col.index,
          type: col.type,
        });
      });

      // Process rows into tasks
      const tasks = [];
      for (const row of sheetData.rows) {
        const task: Record<string, any> = {
          name: '',
          description: '',
          status: 'todo',
          dueDate: null,
          priority: 'medium',
          projectId,
          source: 'smartsheet',
          externalId: row.id.toString(),
        };

        // Extract cell values based on column titles
        for (const cell of row.cells) {
          const column = columnMap.get(cell.columnId);
          if (!column) continue;

          switch (column.title) {
            case 'Task Name':
              task.name = cell.value || 'Untitled Task';
              break;
            case 'Description':
              task.description = cell.value || '';
              break;
            case 'Status':
              // Map Smartsheet status to our status
              if (cell.value === 'Done') {
                task.status = 'done';
                task.isCompleted = true;
              } else if (cell.value === 'In Progress') {
                task.status = 'in-progress';
              }
              break;
            case 'Due Date':
              if (cell.value) {
                task.dueDate = new Date(cell.value);
              }
              break;
            case 'Priority':
              if (cell.value === 'High') {
                task.priority = 'high';
              } else if (cell.value === 'Low') {
                task.priority = 'low';
              }
              break;
            case 'Assignee':
              // Store assignee info in sourceData for now
              if (cell.value) {
                task.sourceData = {
                  ...task.sourceData,
                  assignee: cell.value,
                };
              }
              break;
          }
        }

        // Only add tasks with a name
        if (task.name) {
          tasks.push(task);
        }
      }

      return {
        success: true,
        message: `Successfully pulled ${tasks.length} tasks from Smartsheet`,
        data: tasks,
      };
    } catch (error) {
      console.error('Error pulling tasks from Smartsheet:', error);
      return {
        success: false,
        message: 'Failed to pull tasks from Smartsheet',
        errors: [error],
      };
    }
  }

  /**
   * Push a task to Smartsheet
   */
  async pushTask(task: TaskData): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Smartsheet',
      };
    }

    try {
      // Get the project to find its external ID (sheet ID)
      const project = await storage.getProject(task.projectId);
      if (!project || !project.externalId) {
        return {
          success: false,
          message: 'Project has no external Smartsheet ID',
        };
      }

      const sheetId = project.externalId;

      // Get sheet to find column IDs
      const sheetResponse = await axios.get(`${SMARTSHEET_API_URL}/sheets/${sheetId}`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
        },
      });

      const columns = sheetResponse.data.columns;
      
      // Map our task fields to Smartsheet columns
      const cells = [];
      for (const column of columns) {
        switch (column.title) {
          case 'Task Name':
            cells.push({
              columnId: column.id,
              value: task.name,
            });
            break;
          case 'Description':
            cells.push({
              columnId: column.id,
              value: task.description || '',
            });
            break;
          case 'Status':
            // Map our status to Smartsheet status
            let status = 'To Do';
            if (task.status === 'done' || task.isCompleted) {
              status = 'Done';
            } else if (task.status === 'in-progress') {
              status = 'In Progress';
            }
            cells.push({
              columnId: column.id,
              value: status,
            });
            break;
          case 'Due Date':
            if (task.dueDate) {
              cells.push({
                columnId: column.id,
                value: new Date(task.dueDate).toISOString().split('T')[0],
                strict: false,
              });
            }
            break;
          case 'Priority':
            // Map our priority to Smartsheet priority
            let priority = 'Medium';
            if (task.priority === 'high') {
              priority = 'High';
            } else if (task.priority === 'low') {
              priority = 'Low';
            }
            cells.push({
              columnId: column.id,
              value: priority,
            });
            break;
        }
      }

      // Create or update row in Smartsheet
      if (task.externalId) {
        // Update existing row
        const response = await axios.put(
          `${SMARTSHEET_API_URL}/sheets/${sheetId}/rows`,
          {
            id: task.externalId,
            cells,
          },
          {
            headers: {
              Authorization: `Bearer ${this.integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          success: true,
          message: 'Successfully updated task in Smartsheet',
          data: {
            externalId: response.data.result.id.toString(),
          },
        };
      } else {
        // Create new row
        const response = await axios.post(
          `${SMARTSHEET_API_URL}/sheets/${sheetId}/rows`,
          {
            toBottom: true,
            cells,
          },
          {
            headers: {
              Authorization: `Bearer ${this.integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          success: true,
          message: 'Successfully created task in Smartsheet',
          data: {
            externalId: response.data.result.id.toString(),
          },
        };
      }
    } catch (error) {
      console.error('Error pushing task to Smartsheet:', error);
      return {
        success: false,
        message: 'Failed to push task to Smartsheet',
        errors: [error],
      };
    }
  }

  /**
   * Refresh the access token if needed
   */
  protected async refreshTokenIfNeeded(): Promise<boolean> {
    if (!this.integration) {
      return false;
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const now = new Date();
    const expiryTime = this.integration.tokenExpiry;
    
    if (!expiryTime || !this.integration.refreshToken) {
      return false;
    }

    const expiryDate = new Date(expiryTime);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiryDate > fiveMinutesFromNow) {
      // Token is still valid
      return true;
    }

    try {
      if (!SMARTSHEET_CLIENT_ID || !SMARTSHEET_CLIENT_SECRET) {
        throw new Error('Smartsheet client credentials are not configured');
      }

      // Refresh token
      const response = await axios.post(
        SMARTSHEET_TOKEN_URL,
        querystring.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.integration.refreshToken,
          client_id: SMARTSHEET_CLIENT_ID,
          client_secret: SMARTSHEET_CLIENT_SECRET,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

      // Calculate new expiry time
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + expires_in);

      // Update integration in database
      await this.updateIntegration({
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
      });

      return true;
    } catch (error) {
      console.error('Error refreshing Smartsheet token:', error);
      return false;
    }
  }
}