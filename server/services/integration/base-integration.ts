import { IntegrationProvider } from "@shared/integrations";
import { Integration } from "@shared/schema";
import { storage } from "../../storage";

export interface TaskData {
  name: string;
  description?: string;
  status?: string;
  dueDate?: Date | string;
  priority?: string;
  assigneeId?: string;
  externalId?: string;
  projectId: number;
  isCompleted?: boolean;
  sourceData?: Record<string, any>;
}

export interface ProjectData {
  name: string;
  description?: string;
  dueDate?: Date | string;
  externalId: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: any[];
}

/**
 * Base class for all integration services
 */
export abstract class BaseIntegrationService {
  protected userId: string;
  protected provider: IntegrationProvider;
  protected integration: Integration | undefined;

  constructor(userId: string, provider: IntegrationProvider) {
    this.userId = userId;
    this.provider = provider;
    this.integration = undefined;
  }

  /**
   * Initialize the integration service
   */
  async initialize(): Promise<boolean> {
    try {
      this.integration = await storage.getIntegrationByProvider(this.userId, this.provider);
      return !!this.integration && this.integration.isConnected;
    } catch (error) {
      console.error(`Error initializing ${this.provider} integration:`, error);
      return false;
    }
  }

  /**
   * Check if the integration is connected
   */
  isConnected(): boolean {
    return !!this.integration && this.integration.isConnected;
  }

  /**
   * Get the OAuth URL for the provider
   */
  abstract getAuthUrl(): string;

  /**
   * Handle the OAuth callback
   */
  abstract handleOAuthCallback(code: string, redirectUri: string): Promise<boolean>;

  /**
   * Push a task to the external provider
   */
  abstract pushTask(task: TaskData): Promise<SyncResult>;

  /**
   * Pull tasks from the external provider
   */
  abstract pullTasks(projectId: number, externalProjectId?: string): Promise<SyncResult>;

  /**
   * Push a project to the external provider
   */
  abstract pushProject(project: ProjectData): Promise<SyncResult>;

  /**
   * Pull projects from the external provider
   */
  abstract pullProjects(): Promise<SyncResult>;

  /**
   * Get available workspaces or boards
   */
  abstract getWorkspaces(): Promise<{ id: string; name: string }[]>;

  /**
   * Refresh the access token if needed
   */
  protected abstract refreshTokenIfNeeded(): Promise<boolean>;

  /**
   * Update the integration in the database
   */
  protected async updateIntegration(data: Partial<Integration>): Promise<Integration | undefined> {
    if (!this.integration) {
      return undefined;
    }

    try {
      const updated = await storage.updateIntegration(this.integration.id, data);
      this.integration = updated;
      return updated;
    } catch (error) {
      console.error(`Error updating ${this.provider} integration:`, error);
      return undefined;
    }
  }
}