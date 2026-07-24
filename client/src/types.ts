// Integration Providers
// Import from the centralized location
import IntegrationProvider from './types/integration';
export { IntegrationProvider };

// Integration Provider Type
export type IntegrationProviderType = "smartsheet" | "jira" | "asana" | "github" | "clickup" | "google_docs" | "monday";

// AI Project Plan Structure
export interface AIProjectPlan {
  name: string;
  description: string;
  estimatedDuration: string;
  milestones: Array<{
    name: string;
    description: string;
    tasks: Array<{
      name: string;
      description: string;
      estimatedHours: number;
    }>;
  }>;
  risks: Array<{
    description: string;
    mitigationStrategy: string; 
    severity: "low" | "medium" | "high";
  }>;
  resources: string[];
}

// Project Task Structure
export interface ProjectTask {
  id: number;
  name: string;
  description: string | null;
  status: string;
  isCompleted: boolean;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  projectId: number;
  parentTaskId: number | null;
  assigneeId: string | null;
  createdAt: string;
}

// New Task Creation Input
export interface NewTask {
  name: string;
  description?: string;
  dueDate?: Date;
  priority?: string;
  status?: string;
  projectId: number;
  parentTaskId?: number | null;
  assigneeId?: string | null;
}

// Project Structure
export interface Project {
  id: number;
  name: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  icon: string;
  iconBg: string;
  createdAt: string;
  ownerId: string;
  externalId: string | null;
  source: string;
  sourceData: any | null;
  aiGenerated: boolean;
}

// New Project Creation Input
export interface NewProject {
  name: string;
  description?: string;
  dueDate?: Date;
  icon?: string;
  iconBg?: string;
  source?: string;
  aiGenerated?: boolean;
}