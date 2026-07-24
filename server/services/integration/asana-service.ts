import axios from 'axios';
import querystring from 'querystring';
import { IntegrationProvider } from '@shared/integrations';
import { BaseIntegrationService, ProjectData, SyncResult, TaskData } from './base-integration';
import { storage } from '../../storage';
import { config } from '../../config/environment';

// Asana API Constants - now configurable via environment
const ASANA_API_URL = config.oauth.asana.apiUrl;
const ASANA_AUTH_URL = config.oauth.asana.authUrl;
const ASANA_TOKEN_URL = config.oauth.asana.tokenUrl;

// You'll need to set these environment variables
const ASANA_CLIENT_ID = process.env.ASANA_CLIENT_ID;
const ASANA_CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;

export class AsanaService extends BaseIntegrationService {
  constructor(userId: string) {
    super(userId, IntegrationProvider.ASANA);
  }

  /**
   * Get the OAuth URL for Asana
   */
  getAuthUrl(): string {
    if (!ASANA_CLIENT_ID) {
      throw new Error('Asana integration is not configured. Please contact your administrator to set up ASANA_CLIENT_ID and ASANA_CLIENT_SECRET environment variables.');
    }

    const params = {
      client_id: ASANA_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${config.urls.backend}/api/integrations/oauth/asana`,
      state: this.userId, // Store user ID in state for callback verification
      scope: 'default',
    };

    return `${ASANA_AUTH_URL}?${querystring.stringify(params)}`;
  }

  /**
   * Handle the OAuth callback from Asana
   */
  async handleOAuthCallback(code: string, redirectUri: string): Promise<boolean> {
    try {
      if (!ASANA_CLIENT_ID || !ASANA_CLIENT_SECRET) {
        throw new Error('Asana client credentials are not configured');
      }

      // Exchange authorization code for access token
      const tokenResponse = await axios.post(
        ASANA_TOKEN_URL,
        querystring.stringify({
          grant_type: 'authorization_code',
          client_id: ASANA_CLIENT_ID,
          client_secret: ASANA_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
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
      let integration = await storage.getIntegrationByProvider(this.userId, IntegrationProvider.ASANA);

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
          provider: IntegrationProvider.ASANA,
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiry,
          isConnected: true,
        });
      }

      // Fetch and store workspaces
      const workspaces = await this.getWorkspaces();
      
      this.integration = integration;
      return true;
    } catch (error) {
      console.error('Error handling Asana OAuth callback:', error);
      return false;
    }
  }

  /**
   * Get workspaces from Asana
   */
  async getWorkspaces(): Promise<{ id: string; name: string }[]> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return [];
    }

    try {
      // Get all workspaces
      const response = await axios.get(`${ASANA_API_URL}/workspaces`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
        },
      });

      const workspaces = response.data.data.map((workspace: any) => ({
        id: workspace.gid,
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
      console.error('Error fetching Asana workspaces:', error);
      return [];
    }
  }

  /**
   * Get projects from Asana for a specific workspace
   */
  async getProjects(workspaceId: string): Promise<{ id: string; name: string; workspaceId: string }[]> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return [];
    }

    try {
      // Get all projects in the workspace
      const response = await axios.get(`${ASANA_API_URL}/projects`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
        },
        params: {
          workspace: workspaceId,
          opt_fields: 'name,gid',
        },
      });

      const projects = response.data.data.map((project: any) => ({
        id: project.gid,
        name: project.name,
        workspaceId,
      }));

      // Save projects to integration data
      const additionalData = this.integration.additionalData || {};
      const existingProjects = additionalData.projects || [];
      
      // Filter out projects from this workspace and add new ones
      const filteredProjects = existingProjects.filter((p: any) => p.workspaceId !== workspaceId);
      
      await this.updateIntegration({
        additionalData: {
          ...additionalData,
          projects: [...filteredProjects, ...projects],
        },
      });

      return projects;
    } catch (error) {
      console.error('Error fetching Asana projects:', error);
      return [];
    }
  }

  /**
   * Pull projects from Asana
   */
  async pullProjects(): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Asana',
      };
    }

    try {
      // Get all workspaces
      const workspaces = await this.getWorkspaces();
      
      // Get projects for each workspace
      const allProjects = [];
      for (const workspace of workspaces) {
        const projects = await this.getProjects(workspace.id);
        allProjects.push(...projects);
      }
      
      // Format projects for Requisor
      const requisorProjects = allProjects.map(project => ({
        name: project.name,
        description: `Imported from Asana - ${project.name}`,
        externalId: project.id,
        source: 'asana',
        sourceData: {
          workspaceId: project.workspaceId,
        },
        ownerId: this.userId,
      }));

      return {
        success: true,
        message: `Successfully pulled ${requisorProjects.length} projects from Asana`,
        data: requisorProjects,
      };
    } catch (error) {
      console.error('Error pulling projects from Asana:', error);
      return {
        success: false,
        message: 'Failed to pull projects from Asana',
        errors: [error],
      };
    }
  }

  /**
   * Push a project to Asana
   */
  async pushProject(project: ProjectData): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Asana',
      };
    }

    try {
      // Get workspace ID from integration data
      const additionalData = this.integration.additionalData || {};
      const workspaces = additionalData.workspaces || [];
      
      if (workspaces.length === 0) {
        return {
          success: false,
          message: 'No Asana workspaces found. Please sync workspaces first.',
        };
      }
      
      // Use the first workspace if none specified
      const workspaceId = this.integration.workspaceId || workspaces[0].id;

      // Create a new project in Asana
      const response = await axios.post(
        `${ASANA_API_URL}/projects`,
        {
          data: {
            name: project.name,
            notes: project.description,
            workspace: workspaceId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const asanaProject = response.data.data;

      return {
        success: true,
        message: 'Successfully created project in Asana',
        data: {
          externalId: asanaProject.gid,
          name: asanaProject.name,
        },
      };
    } catch (error) {
      console.error('Error pushing project to Asana:', error);
      return {
        success: false,
        message: 'Failed to create project in Asana',
        errors: [error],
      };
    }
  }

  /**
   * Pull tasks from an Asana project
   */
  async pullTasks(projectId: number, externalProjectId?: string): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Asana',
      };
    }

    if (!externalProjectId) {
      // Try to get the external ID from the project
      const project = await storage.getProject(projectId);
      if (!project || !project.externalId) {
        return {
          success: false,
          message: 'No external project ID provided or found in project',
        };
      }
      externalProjectId = project.externalId;
    }

    try {
      // Get tasks for the project
      const response = await axios.get(`${ASANA_API_URL}/tasks`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
        },
        params: {
          project: externalProjectId,
          opt_fields: 'name,notes,due_on,completed,assignee,assignee.name',
        },
      });

      const asanaTasks = response.data.data;
      
      // Process tasks into Requisor format
      const tasks = asanaTasks.map((asanaTask: any) => {
        const task: Record<string, any> = {
          name: asanaTask.name,
          description: asanaTask.notes || '',
          status: asanaTask.completed ? 'done' : 'todo',
          isCompleted: asanaTask.completed,
          projectId,
          source: 'asana',
          externalId: asanaTask.gid,
        };

        if (asanaTask.due_on) {
          task.dueDate = new Date(asanaTask.due_on);
        }

        if (asanaTask.assignee) {
          // Store assignee info in sourceData for now
          task.sourceData = {
            assignee: {
              id: asanaTask.assignee.gid,
              name: asanaTask.assignee.name,
            },
          };
        }

        return task;
      });

      return {
        success: true,
        message: `Successfully pulled ${tasks.length} tasks from Asana`,
        data: tasks,
      };
    } catch (error) {
      console.error('Error pulling tasks from Asana:', error);
      return {
        success: false,
        message: 'Failed to pull tasks from Asana',
        errors: [error],
      };
    }
  }

  /**
   * Push a task to Asana
   */
  async pushTask(task: TaskData): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken) {
      return {
        success: false,
        message: 'Not connected to Asana',
      };
    }

    try {
      // Get the project to find its external ID
      const project = await storage.getProject(task.projectId);
      if (!project || !project.externalId) {
        return {
          success: false,
          message: 'Project has no external Asana ID',
        };
      }

      const externalProjectId = project.externalId;

      // Prepare task data for Asana
      const asanaTaskData: Record<string, any> = {
        name: task.name,
        notes: task.description,
        projects: [externalProjectId],
      };

      if (task.dueDate) {
        // Format date as YYYY-MM-DD
        const dueDate = new Date(task.dueDate);
        asanaTaskData.due_on = dueDate.toISOString().split('T')[0];
      }

      if (task.isCompleted || task.status === 'done') {
        asanaTaskData.completed = true;
      }

      // Create or update task in Asana
      if (task.externalId) {
        // Update existing task
        const response = await axios.put(
          `${ASANA_API_URL}/tasks/${task.externalId}`,
          {
            data: asanaTaskData,
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
          message: 'Successfully updated task in Asana',
          data: {
            externalId: response.data.data.gid,
          },
        };
      } else {
        // Create new task
        const response = await axios.post(
          `${ASANA_API_URL}/tasks`,
          {
            data: asanaTaskData,
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
          message: 'Successfully created task in Asana',
          data: {
            externalId: response.data.data.gid,
          },
        };
      }
    } catch (error) {
      console.error('Error pushing task to Asana:', error);
      return {
        success: false,
        message: 'Failed to push task to Asana',
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
      if (!ASANA_CLIENT_ID || !ASANA_CLIENT_SECRET) {
        throw new Error('Asana client credentials are not configured');
      }

      // Refresh token
      const response = await axios.post(
        ASANA_TOKEN_URL,
        querystring.stringify({
          grant_type: 'refresh_token',
          client_id: ASANA_CLIENT_ID,
          client_secret: ASANA_CLIENT_SECRET,
          refresh_token: this.integration.refreshToken,
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
      console.error('Error refreshing Asana token:', error);
      return false;
    }
  }
}