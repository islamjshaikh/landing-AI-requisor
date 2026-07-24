// AI Planning Agent Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  projectId?: number;
  actions?: ChatAction[];
  commandIntent?: CommandIntent;
  suggestions?: Suggestion[];
  projectPlan?: ProjectPlan;
}

export interface ProjectPlan {
  name: string;
  description: string;
  timeline: string;
  milestones: MilestonePlan[];
  tasks: TaskPlan[];
}

export interface MilestonePlan {
  name: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

export interface TaskPlan {
  name: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours?: number;
  milestone?: string;
}

export interface ChatAction {
  id: string;
  type: ActionType;
  label: string;
  data: any;
  executed?: boolean;
  confirmationRequired?: boolean;
  preview?: string;
}

export type ActionType = 
  | 'create_project' 
  | 'create_task' 
  | 'create_milestone'
  | 'update_task' 
  | 'update_project'
  | 'delete_task' 
  | 'delete_project'
  | 'analyze_project' 
  | 'assign_task'
  | 'optimize_timeline'
  | 'generate_template'
  | 'schedule_milestone'
  | 'show_overdue'
  | 'adjust_priority';

export interface CommandIntent {
  type: 'project_creation' | 'task_management' | 'timeline_optimization' | 'analysis' | 'template_generation';
  confidence: number;
  extractedData: Record<string, any>;
  missingInputs: string[];
}

export interface Suggestion {
  id: string;
  type: 'improvement' | 'template' | 'optimization' | 'clarification';
  content: string;
  actionable?: ChatAction;
}

export interface ChatSession {
  id: string;
  userId: string;
  projectId?: number;
  messages: ChatMessage[];
  context: SessionContext;
  persistentMemory: PersistentMemory;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionContext {
  currentProject?: {
    id: number;
    name: string;
    status: string;
    dueDate?: string;
    progress: number;
  };
  projects?: Array<{
    id: number;
    name: string;
    status: string;
    dueDate?: string;
    progress: number;
  }>;
  tasks?: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
    assignedTo?: string;
  }>;
  recentActivity?: Array<{
    type: string;
    timestamp: string;
    description: string;
  }>;
  allProjects?: Array<{
    id: number;
    name: string;
    status: string;
    dueDate?: string;
    progress: number;
    totalTasks: number;
    completedTasks: number;
  }>;
  recentTasks?: Array<{
    id: number;
    name: string;
    projectName?: string;
    projectId?: number;
    status: string;
    dueDate?: string;
    priority: string;
  }>;
  overdueTasks?: Array<{
    id: number;
    name: string;
    projectName: string;
    projectId: number;
    status: string;
    dueDate: string;
    priority: string;
  }>;
  upcomingTasks?: Array<{
    id: number;
    name: string;
    projectName: string;
    projectId: number;
    status: string;
    dueDate: string;
    priority: string;
  }>;
  projectCount?: number;
  activeProjectsCount?: number;
  userPreferences?: {
    defaultAssignee?: string;
    preferredTimezone?: string;
    workingHours?: string;
    communicationStyle?: 'brief' | 'detailed' | 'conversational';
  };
  activeDiscussion?: {
    topic: string;
    stage: 'gathering_requirements' | 'refining_details' | 'confirming_actions';
    pendingQuestions: string[];
  };
}

export interface PersistentMemory {
  projectTypes: Array<{
    type: string;
    frequency: number;
    lastUsed: Date;
    preferredStructure: any;
  }>;
  commonPatterns: Array<{
    pattern: string;
    usage: number;
    context: string;
  }>;
  learningPoints: Array<{
    insight: string;
    confidence: number;
    datelearned: Date;
  }>;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  phases: Array<{
    name: string;
    duration: string;
    tasks: Array<{
      name: string;
      description: string;
      estimatedHours: number;
      dependencies: string[];
    }>;
  }>;
  suggestedTimeline: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface PlanningInsight {
  type: 'timeline_risk' | 'resource_conflict' | 'scope_creep' | 'optimization_opportunity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  affectedItems: string[];
  recommendations: string[];
  autoFixAvailable?: boolean;
}

export interface ProjectAnalysis {
  overdueTasks: Array<{
    id: number;
    name: string;
    dueDate: string;
    daysPastDue: number;
  }>;
  bottlenecks: Array<{
    issue: string;
    impact: 'low' | 'medium' | 'high';
    suggestions: string[];
  }>;
  insights: PlanningInsight[];
  healthScore: number; // 0-100
  recommendations: string[];
  timelineOptimizations: Array<{
    description: string;
    timeSaved: string;
    effort: 'low' | 'medium' | 'high';
  }>;
}

export interface CommandParseResult {
  intent: CommandIntent;
  confidence: number;
  suggestedActions: ChatAction[];
  clarificationNeeded: boolean;
  questions: string[];
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  examples: string[];
  parameters: Record<string, any>;
  category: 'project_management' | 'planning' | 'analysis' | 'optimization';
}