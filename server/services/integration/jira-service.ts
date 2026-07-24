import axios from 'axios';
import querystring from 'querystring';
import { IntegrationProvider } from '@shared/integrations';
import { BaseIntegrationService, ProjectData, SyncResult, TaskData } from './base-integration';
import { storage } from '../../storage';
import { config } from '../../config/environment';

// Jira API Constants - now configurable via environment
const JIRA_AUTH_URL = config.oauth.jira.authUrl;
const JIRA_TOKEN_URL = config.oauth.jira.tokenUrl;
const JIRA_API_URL = config.oauth.jira.apiUrl;

// You'll need to set these environment variables
const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID;
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET;

export class JiraService extends BaseIntegrationService {
  constructor(userId: string) {
    super(userId, IntegrationProvider.JIRA);
  }

  /**
   * Get the OAuth URL for Jira
   */
  getAuthUrl(): string {
    if (!JIRA_CLIENT_ID) {
      throw new Error('Jira integration is not configured. Please contact your administrator to set up JIRA_CLIENT_ID and JIRA_CLIENT_SECRET environment variables.');
    }

    const params = {
      audience: 'api.atlassian.com',
      client_id: JIRA_CLIENT_ID,
      scope: 'read:jira-work write:jira-work manage:jira-project read:jira-user offline_access',
      redirect_uri: `${config.urls.backend}/api/integrations/oauth/jira`,
      state: this.userId, // Store user ID in state for callback verification
      response_type: 'code',
      prompt: 'consent',
    };

    return `${JIRA_AUTH_URL}?${querystring.stringify(params)}`;
  }

  /**
   * Handle the OAuth callback from Jira
   */
  async handleOAuthCallback(code: string, redirectUri: string): Promise<boolean> {
    try {
      if (!JIRA_CLIENT_ID || !JIRA_CLIENT_SECRET) {
        throw new Error('Jira client credentials are not configured');
      }

      // Exchange authorization code for access token
      const tokenResponse = await axios.post(
        JIRA_TOKEN_URL,
        {
          grant_type: 'authorization_code',
          client_id: JIRA_CLIENT_ID,
          client_secret: JIRA_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Calculate token expiry date
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + expires_in);

      // Get cloud ID (required for API calls)
      const cloudId = await this.getCloudId(access_token);
      if (!cloudId) {
        throw new Error('Could not retrieve Jira Cloud ID');
      }

      // Check if integration exists
      let integration = await storage.getIntegrationByProvider(this.userId, IntegrationProvider.JIRA);

      // Prepare additional data with cloudId
      const additionalData = {
        cloudId,
        projects: [],
        issueTypes: [],
        statuses: [],
      };

      if (integration) {
        // Update existing integration
        integration = await storage.updateIntegration(integration.id, {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiry,
          isConnected: true,
          lastSynced: new Date(),
          additionalData,
        });
      } else {
        // Create new integration
        integration = await storage.createIntegration({
          userId: this.userId,
          provider: IntegrationProvider.JIRA,
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiry,
          isConnected: true,
          additionalData,
        });
      }

      this.integration = integration;
      return true;
    } catch (error) {
      console.error('Error handling Jira OAuth callback:', error);
      return false;
    }
  }

  /**
   * Get the Atlassian cloud ID
   */
  private async getCloudId(accessToken: string): Promise<string | null> {
    try {
      const response = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      // Return the ID of the first site (most users only have one)
      if (response.data && response.data.length > 0) {
        return response.data[0].id;
      }
      return null;
    } catch (error) {
      console.error('Error fetching Jira cloud ID:', error);
      return null;
    }
  }

  /**
   * Get workspaces from Jira (projects in Jira terminology)
   */
  async getWorkspaces(): Promise<{ id: string; name: string }[]> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken || !this.integration.additionalData?.cloudId) {
      console.log('JIRA API Response - Missing access token or cloud ID');
      return [];
    }

    try {
      const cloudId = this.integration.additionalData.cloudId;
      
      console.log(`JIRA API Response - Fetching all projects with manage permissions for cloud ID: ${cloudId}`);
      
      // Get all projects - this endpoint returns all projects the user has access to
      // With the manage:jira-project scope, this will include projects where user has management permissions
      const response = await axios.get(`${JIRA_API_URL}/${cloudId}/rest/api/3/project/search`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
          Accept: 'application/json',
        },
        params: {
          expand: 'description,lead,url',
          maxResults: 1000, // Increase from default 50 to get all projects
        },
      });

      console.log('JIRA API Response - Raw projects:', response.data.values || response.data);
      console.log('JIRA API Response - Number of projects:', (response.data.values || response.data).length);

      // Handle both paginated and non-paginated responses
      const projectList = response.data.values || response.data;
      
      const projects = projectList.map((project: any) => ({
        id: project.id,
        key: project.key,
        name: project.name,
      }));

      console.log('JIRA API Response - Mapped projects:', projects);

      // Save projects to integration data
      const additionalData = {
        ...this.integration.additionalData,
        projects,
      };

      await this.updateIntegration({ additionalData });

      // Also fetch issue types and statuses
      await this.getIssueTypes();
      await this.getStatuses();

      return projects;
    } catch (error: any) {
      console.error('Error fetching Jira projects:', error);
      if (error.response) {
        console.error('JIRA API Error Response:', error.response.data);
        console.error('JIRA API Error Status:', error.response.status);
      }
      return [];
    }
  }

  /**
   * Get issue types from Jira
   */
  private async getIssueTypes(): Promise<void> {
    if (!this.integration?.accessToken || !this.integration.additionalData?.cloudId) {
      return;
    }

    try {
      const cloudId = this.integration.additionalData.cloudId;
      
      // Get all issue types
      const response = await axios.get(`${JIRA_API_URL}/${cloudId}/rest/api/3/issuetype`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
          Accept: 'application/json',
        },
      });

      const issueTypes = response.data.map((issueType: any) => ({
        id: issueType.id,
        name: issueType.name,
        description: issueType.description,
      }));

      // Save issue types to integration data
      const additionalData = {
        ...this.integration.additionalData,
        issueTypes,
      };

      await this.updateIntegration({ additionalData });
    } catch (error) {
      console.error('Error fetching Jira issue types:', error);
    }
  }

  /**
   * Get statuses from Jira
   */
  private async getStatuses(): Promise<void> {
    if (!this.integration?.accessToken || !this.integration.additionalData?.cloudId) {
      return;
    }

    try {
      const cloudId = this.integration.additionalData.cloudId;
      
      // Get all statuses
      const response = await axios.get(`${JIRA_API_URL}/${cloudId}/rest/api/3/status`, {
        headers: {
          Authorization: `Bearer ${this.integration.accessToken}`,
          Accept: 'application/json',
        },
      });

      const statuses = response.data.map((status: any) => ({
        id: status.id,
        name: status.name,
        statusCategory: status.statusCategory?.name,
      }));

      // Save statuses to integration data
      const additionalData = {
        ...this.integration.additionalData,
        statuses,
      };

      await this.updateIntegration({ additionalData });
    } catch (error) {
      console.error('Error fetching Jira statuses:', error);
    }
  }

  /**
   * Pull projects from Jira
   */
  async pullProjects(): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken || !this.integration.additionalData?.cloudId) {
      return {
        success: false,
        message: 'Not connected to Jira',
      };
    }

    try {
      // Get all projects
      const projects = await this.getWorkspaces();
      
      // Format projects for Requisor
      const requisorProjects = projects.map(project => ({
        name: project.name,
        description: `Imported from Jira - ${project.name} (${project.key})`,
        externalId: project.id,
        source: 'jira',
        sourceData: {
          key: project.key,
        },
        ownerId: this.userId,
      }));

      return {
        success: true,
        message: `Successfully pulled ${requisorProjects.length} projects from Jira`,
        data: requisorProjects,
      };
    } catch (error) {
      console.error('Error pulling projects from Jira:', error);
      return {
        success: false,
        message: 'Failed to pull projects from Jira',
        errors: [error],
      };
    }
  }

  /**
   * Push a project to Jira
   */
  async pushProject(project: ProjectData): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken || !this.integration.additionalData?.cloudId) {
      return {
        success: false,
        message: 'Not connected to Jira',
      };
    }

    try {
      const cloudId = this.integration.additionalData.cloudId;
      
      // Generate a key for the project (must be uppercase, no spaces)
      const key = project.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10);
      
      // Create a new project in Jira
      const response = await axios.post(
        `${JIRA_API_URL}/${cloudId}/rest/api/3/project`,
        {
          key,
          name: project.name,
          description: project.description,
          projectTypeKey: 'software',
          leadAccountId: '', // This should be populated with the user's Jira account ID
        },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const jiraProject = response.data;

      return {
        success: true,
        message: 'Successfully created project in Jira',
        data: {
          externalId: jiraProject.id,
          key: jiraProject.key,
        },
      };
    } catch (error) {
      console.error('Error pushing project to Jira:', error);
      return {
        success: false,
        message: 'Failed to create project in Jira',
        errors: [error],
      };
    }
  }

  /**
   * Pull tasks from a Jira project
   */
  async pullTasks(projectId: number, externalProjectId?: string): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken || !this.integration.additionalData?.cloudId) {
      return {
        success: false,
        message: 'Not connected to Jira',
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
      const cloudId = this.integration.additionalData.cloudId;
      const projectKey = this.getProjectKeyById(externalProjectId);
      
      if (!projectKey) {
        return {
          success: false,
          message: 'Could not find project key for the given project ID',
        };
      }
      
      // Search for issues in the project
      const jql = `project = ${projectKey} ORDER BY created DESC`;
      
      const response = await axios.post(
        `${JIRA_API_URL}/${cloudId}/rest/api/3/search`,
        {
          jql,
          maxResults: 100,
          fields: [
            'summary',
            'description',
            'status',
            'priority',
            'duedate',
            'assignee',
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const issues = response.data.issues;
      
      // Map statuses for conversion
      const statuses = this.integration.additionalData.statuses || [];
      
      // Process issues into tasks
      const tasks = [];
      for (const issue of issues) {
        const task: Record<string, any> = {
          name: issue.fields.summary,
          description: issue.fields.description ? this.convertJiraDescription(issue.fields.description) : '',
          status: 'todo',
          projectId,
          source: 'jira',
          externalId: issue.id,
          sourceData: {
            key: issue.key,
            issueType: issue.fields.issuetype?.name,
          },
        };

        // Map Jira status to our status
        if (issue.fields.status) {
          const statusObj = statuses.find((s: any) => s.id === issue.fields.status.id);
          if (statusObj) {
            if (statusObj.statusCategory === 'Done') {
              task.status = 'done';
              task.isCompleted = true;
            } else if (statusObj.statusCategory === 'In Progress') {
              task.status = 'in-progress';
            }
          }
        }

        // Set due date if present
        if (issue.fields.duedate) {
          task.dueDate = new Date(issue.fields.duedate);
        }

        // Set priority if present
        if (issue.fields.priority) {
          const priorityName = issue.fields.priority.name.toLowerCase();
          if (priorityName.includes('high') || priorityName.includes('critical')) {
            task.priority = 'high';
          } else if (priorityName.includes('low') || priorityName.includes('minor')) {
            task.priority = 'low';
          } else {
            task.priority = 'medium';
          }
        }

        // Store assignee info
        if (issue.fields.assignee) {
          task.sourceData.assignee = {
            id: issue.fields.assignee.accountId,
            name: issue.fields.assignee.displayName,
            email: issue.fields.assignee.emailAddress,
          };
        }

        tasks.push(task);
      }

      return {
        success: true,
        message: `Successfully pulled ${tasks.length} tasks from Jira`,
        data: tasks,
      };
    } catch (error) {
      console.error('Error pulling tasks from Jira:', error);
      return {
        success: false,
        message: 'Failed to pull tasks from Jira',
        errors: [error],
      };
    }
  }

  /**
   * Get project key by ID
   */
  private getProjectKeyById(projectId: string): string | null {
    const projects = this.integration?.additionalData?.projects || [];
    const project = projects.find((p: any) => p.id === projectId);
    return project ? project.key : null;
  }

  /**
   * Convert Jira's Atlassian Document Format to plain text
   */
  private convertJiraDescription(description: any): string {
    if (!description || !description.content) {
      return '';
    }

    let plainText = '';
    
    // Extract text from the Atlassian Document Format
    const extractText = (content: any[]) => {
      if (!content || !Array.isArray(content)) {
        return;
      }
      
      for (const item of content) {
        if (item.text) {
          plainText += item.text;
        }
        if (item.content) {
          extractText(item.content);
        }
        // Add newline after paragraphs
        if (item.type === 'paragraph') {
          plainText += '\n';
        }
      }
    };
    
    extractText(description.content);
    return plainText.trim();
  }

  /**
   * Push a task to Jira
   */
  async pushTask(task: TaskData): Promise<SyncResult> {
    await this.refreshTokenIfNeeded();
    
    if (!this.integration?.accessToken || !this.integration.additionalData?.cloudId) {
      return {
        success: false,
        message: 'Not connected to Jira',
      };
    }

    try {
      const cloudId = this.integration.additionalData.cloudId;
      
      // Get the project to find its external ID and key
      const project = await storage.getProject(task.projectId);
      if (!project || !project.externalId) {
        return {
          success: false,
          message: 'Project has no external Jira ID',
        };
      }

      const projectKey = this.getProjectKeyById(project.externalId);
      if (!projectKey) {
        return {
          success: false,
          message: 'Could not find project key for the given project',
        };
      }
      
      // Get the issue type ID for "Task"
      const issueTypes = this.integration.additionalData.issueTypes || [];
      const taskIssueType = issueTypes.find((type: any) => type.name === 'Task');
      
      if (!taskIssueType) {
        return {
          success: false,
          message: 'Could not find Task issue type in Jira',
        };
      }

      // Convert plain text description to Jira's Atlassian Document Format
      const description = task.description ? {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: task.description,
              },
            ],
          },
        ],
      } : null;

      // Prepare task data for Jira
      const issueData: Record<string, any> = {
        fields: {
          project: {
            key: projectKey,
          },
          summary: task.name,
          issuetype: {
            id: taskIssueType.id,
          },
        },
      };

      // Add description if present
      if (description) {
        issueData.fields.description = description;
      }

      // Add due date if present
      if (task.dueDate) {
        // Format date as YYYY-MM-DD
        const dueDate = new Date(task.dueDate);
        issueData.fields.duedate = dueDate.toISOString().split('T')[0];
      }

      // Create or update issue in Jira
      if (task.externalId) {
        // Update existing issue
        const response = await axios.put(
          `${JIRA_API_URL}/${cloudId}/rest/api/3/issue/${task.externalId}`,
          issueData,
          {
            headers: {
              Authorization: `Bearer ${this.integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          success: true,
          message: 'Successfully updated issue in Jira',
          data: {
            externalId: task.externalId,
          },
        };
      } else {
        // Create new issue
        const response = await axios.post(
          `${JIRA_API_URL}/${cloudId}/rest/api/3/issue`,
          issueData,
          {
            headers: {
              Authorization: `Bearer ${this.integration.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          success: true,
          message: 'Successfully created issue in Jira',
          data: {
            externalId: response.data.id,
            key: response.data.key,
          },
        };
      }
    } catch (error) {
      console.error('Error pushing task to Jira:', error);
      return {
        success: false,
        message: 'Failed to push task to Jira',
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
      if (!JIRA_CLIENT_ID || !JIRA_CLIENT_SECRET) {
        throw new Error('Jira client credentials are not configured');
      }

      // Refresh token
      const response = await axios.post(
        JIRA_TOKEN_URL,
        {
          grant_type: 'refresh_token',
          client_id: JIRA_CLIENT_ID,
          client_secret: JIRA_CLIENT_SECRET,
          refresh_token: this.integration.refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
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
      console.error('Error refreshing Jira token:', error);
      return false;
    }
  }
}