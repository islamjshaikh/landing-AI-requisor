import { Project, Task, Integration, User, Insight } from "@shared/schema";

// Extend types with UI-specific properties if needed
export interface ProjectWithProgress extends Project {
  progress: number;
  totalTasks: number;
  completedTasks: number;
}

export interface TaskWithAssignee extends Task {
  assignee?: User;
}

export enum IntegrationProvider {
  Smartsheet = "smartsheet",
  Jira = "jira",
  Asana = "asana",
  GoogleDocs = "google_docs",
  Monday = "monday"
}

export interface AIProjectPlan {
  name: string;
  description: string;
  tasks: {
    name: string;
    description?: string;
    dueDate?: string;
    priority?: string;
    assigneeId?: number;
  }[];
  milestones: {
    name: string;
    description?: string;
    dueDate: string;
  }[];
  timeline: {
    startDate: string;
    endDate: string;
    duration: number;
  };
}

// Used for displaying project metrics in the dashboard
export interface ProjectMetrics {
  activeProjects: number;
  onTrackPercentage: number;
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  atRiskProjects: number;
  bottlenecks: number;
}

// For the AI insights panel
export type InsightType = 'bottleneck' | 'resource-conflict' | 'timeline-risk' | 'on-track';

export interface InsightItem extends Insight {
  type: InsightType;
  colorClass: string;
  iconName: string;
}

// For the Advanced AI Analysis feature
export interface AnalysisDimension {
  name: string;
  score: number;
  assessment: string;
  recommendations: string[];
}

export interface DeepAnalysisResult {
  overallRating: number;
  summary: string;
  dimensions: AnalysisDimension[];
  suggestedMethodology: string;
  methodologyRationale: string;
  criticalMissingElements?: string[];
}
