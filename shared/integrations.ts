import { z } from 'zod';

// Define the integration providers enum
export enum IntegrationProvider {
  SMARTSHEET = "smartsheet",
  ASANA = "asana",
  MONDAY = "monday",
  JIRA = "jira"
}

// Base integration schema
export const integrationBaseSchema = z.object({
  provider: z.nativeEnum(IntegrationProvider),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiry: z.date().optional(),
  workspaceId: z.string().optional(),
  isConnected: z.boolean().default(false),
});

// Smartsheet specific settings
export const smartsheetIntegrationSchema = integrationBaseSchema.extend({
  provider: z.literal(IntegrationProvider.SMARTSHEET),
  additionalData: z.object({
    sheets: z.array(z.object({
      id: z.string(),
      name: z.string(),
      url: z.string().optional(),
    })).optional(),
    workspaces: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
  }).optional(),
});

// Asana specific settings
export const asanaIntegrationSchema = integrationBaseSchema.extend({
  provider: z.literal(IntegrationProvider.ASANA),
  additionalData: z.object({
    workspaces: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
    projects: z.array(z.object({
      id: z.string(),
      name: z.string(),
      workspaceId: z.string(),
    })).optional(),
  }).optional(),
});

// Monday.com specific settings
export const mondayIntegrationSchema = integrationBaseSchema.extend({
  provider: z.literal(IntegrationProvider.MONDAY),
  additionalData: z.object({
    boards: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
    workspaces: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
    columns: z.array(z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
    })).optional(),
  }).optional(),
});

// Jira specific settings
export const jiraIntegrationSchema = integrationBaseSchema.extend({
  provider: z.literal(IntegrationProvider.JIRA),
  additionalData: z.object({
    cloudId: z.string().optional(),
    projects: z.array(z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
    })).optional(),
    issueTypes: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
    })).optional(),
    statuses: z.array(z.object({
      id: z.string(),
      name: z.string(),
      statusCategory: z.string().optional(),
    })).optional(),
  }).optional(),
});

// Combined integration schema
export const integrationSchema = z.discriminatedUnion('provider', [
  smartsheetIntegrationSchema,
  asanaIntegrationSchema,
  mondayIntegrationSchema,
  jiraIntegrationSchema,
]);

// Types derived from schemas
export type IntegrationBase = z.infer<typeof integrationBaseSchema>;
export type SmartsheetIntegration = z.infer<typeof smartsheetIntegrationSchema>;
export type AsanaIntegration = z.infer<typeof asanaIntegrationSchema>;
export type MondayIntegration = z.infer<typeof mondayIntegrationSchema>;
export type JiraIntegration = z.infer<typeof jiraIntegrationSchema>;
export type Integration = z.infer<typeof integrationSchema>;

// Types for task mapping
export interface TaskMapping {
  requisorTaskId: number;
  externalId: string;
  provider: IntegrationProvider;
  lastSynced: Date;
  mappedFields: Record<string, any>;
}

// Interface for sync operations
export interface SyncOperation {
  direction: 'push' | 'pull';
  provider: IntegrationProvider;
  items: Array<{
    requisorId?: number;
    externalId?: string;
    type: 'task' | 'project';
    data: Record<string, any>;
  }>;
}