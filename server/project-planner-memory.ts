import { ChatMessage } from "@shared/ai-types";

// Memory structure for each planning session
export interface PlannerMemory {
  sessionId: string;
  userId: string;
  projectContext: ProjectContext;
  conversationHistory: ConversationTurn[];
  pendingClarifications: ClarificationQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectContext {
  name?: string;
  description?: string;
  type?: string; // e.g., "marketing", "software", "onboarding"
  projectType?: string; // Alias for type to match usage in agent
  startDate?: Date;
  endDate?: Date;
  duration?: string;
  teamSize?: number;
  budget?: number;
  owner?: string;
  stakeholders?: string[];
  milestones?: MilestoneContext[];
  constraints?: string[];
  preferences?: string[];
  industry?: string;
  complexity?: 'simple' | 'moderate' | 'complex';
  timeline?: {
    start: string;
    end: string;
  };
  goals?: string[];
}

export interface MilestoneContext {
  name: string;
  description?: string;
  phase?: string;
  dependencies?: string[];
  deliverables?: string[];
}

export interface ConversationTurn {
  userMessage: string;
  assistantResponse: string;
  extractedInfo: Record<string, any>;
  timestamp: Date;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  field: string; // which field this clarifies
  priority: 'required' | 'optional';
  options?: string[]; // for multiple choice
  answered: boolean;
  answer?: string;
}

// Template patterns for common project types
export const PROJECT_TEMPLATES = {
  'marketing_campaign': {
    phases: ['Research & Strategy', 'Creative Development', 'Campaign Execution', 'Analysis & Optimization'],
    typicalDuration: '6-8 weeks',
    requiredInfo: ['target_audience', 'budget', 'channels', 'goals'],
    suggestedTasks: [
      'Define campaign objectives and KPIs',
      'Conduct market research and competitor analysis',
      'Develop buyer personas',
      'Create campaign messaging and creative brief',
      'Design visual assets and copy',
      'Set up tracking and analytics',
      'Launch campaign across channels',
      'Monitor performance and optimize'
    ]
  },
  'software_development': {
    phases: ['Planning & Design', 'Development', 'Testing & QA', 'Deployment & Launch'],
    typicalDuration: '3-6 months',
    requiredInfo: ['tech_stack', 'features', 'users', 'platform'],
    suggestedTasks: [
      'Gather and document requirements',
      'Create technical architecture',
      'Design UI/UX mockups',
      'Set up development environment',
      'Implement core features',
      'Write unit and integration tests',
      'Conduct security review',
      'Deploy to production'
    ]
  },
  'client_onboarding': {
    phases: ['Pre-boarding', 'Kickoff', 'Implementation', 'Training & Handoff'],
    typicalDuration: '2-4 weeks',
    requiredInfo: ['client_name', 'services', 'team_members', 'deliverables'],
    suggestedTasks: [
      'Send welcome package and contracts',
      'Schedule kickoff meeting',
      'Gather client requirements and assets',
      'Set up communication channels',
      'Configure tools and access',
      'Conduct training sessions',
      'Create documentation',
      'Schedule regular check-ins'
    ]
  },
  'product_launch': {
    phases: ['Pre-launch Prep', 'Launch Readiness', 'Launch Execution', 'Post-launch Support'],
    typicalDuration: '8-12 weeks',
    requiredInfo: ['product_name', 'launch_date', 'target_market', 'channels'],
    suggestedTasks: [
      'Finalize product features and pricing',
      'Create go-to-market strategy',
      'Develop marketing materials',
      'Train sales and support teams',
      'Set up distribution channels',
      'Coordinate PR and media outreach',
      'Execute launch day activities',
      'Monitor feedback and iterate'
    ]
  }
};

// Memory management class
export class PlannerMemoryManager {
  private memories: Map<string, PlannerMemory> = new Map();

  createSession(userId: string): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const memory: PlannerMemory = {
      sessionId,
      userId,
      projectContext: {},
      conversationHistory: [],
      pendingClarifications: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.memories.set(sessionId, memory);
    return sessionId;
  }

  getSession(sessionId: string): PlannerMemory | null {
    return this.memories.get(sessionId) || null;
  }

  updateContext(sessionId: string, updates: Partial<ProjectContext>): void {
    const memory = this.memories.get(sessionId);
    if (memory) {
      memory.projectContext = { ...memory.projectContext, ...updates };
      memory.updatedAt = new Date();
    }
  }

  addConversationTurn(sessionId: string, turn: ConversationTurn): void {
    const memory = this.memories.get(sessionId);
    if (memory) {
      memory.conversationHistory.push(turn);
      memory.updatedAt = new Date();
    }
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', message: string): void {
    const memory = this.memories.get(sessionId);
    if (memory) {
      if (role === 'user') {
        // If there's a previous turn without assistant response, add it there
        const lastTurn = memory.conversationHistory[memory.conversationHistory.length - 1];
        if (lastTurn && !lastTurn.assistantResponse) {
          lastTurn.assistantResponse = '';
        }

        // Create new turn for user message
        const turn: ConversationTurn = {
          userMessage: message,
          assistantResponse: '',
          extractedInfo: {},
          timestamp: new Date()
        };
        memory.conversationHistory.push(turn);
      } else {
        // Add assistant response to the last turn
        const lastTurn = memory.conversationHistory[memory.conversationHistory.length - 1];
        if (lastTurn) {
          lastTurn.assistantResponse = message;
        }
      }
      memory.updatedAt = new Date();
    }
  }

  addClarification(sessionId: string, question: ClarificationQuestion): void {
    const memory = this.memories.get(sessionId);
    if (memory) {
      memory.pendingClarifications.push(question);
      memory.updatedAt = new Date();
    }
  }

  answerClarification(sessionId: string, questionId: string, answer: string): void {
    const memory = this.memories.get(sessionId);
    if (memory) {
      const question = memory.pendingClarifications.find(q => q.id === questionId);
      if (question) {
        question.answered = true;
        question.answer = answer;
        memory.updatedAt = new Date();
      }
    }
  }

  getUnansweredClarifications(sessionId: string): ClarificationQuestion[] {
    const memory = this.memories.get(sessionId);
    if (!memory) return [];
    return memory.pendingClarifications.filter(q => !q.answered);
  }

  detectProjectType(sessionId: string): string | null {
    const memory = this.memories.get(sessionId);
    if (!memory) return null;

    const context = memory.projectContext;
    const history = memory.conversationHistory.map(turn => turn.userMessage.toLowerCase()).join(' ');

    // Keywords for project type detection
    if (history.includes('marketing') || history.includes('campaign') || history.includes('advertis')) {
      return 'marketing_campaign';
    }
    if (history.includes('software') || history.includes('app') || history.includes('develop') || history.includes('code')) {
      return 'software_development';
    }
    if (history.includes('onboard') || history.includes('client') || history.includes('customer success')) {
      return 'client_onboarding';
    }
    if (history.includes('launch') || history.includes('release') || history.includes('rollout')) {
      return 'product_launch';
    }

    return null;
  }

  generateMissingInfoQuestions(sessionId: string): ClarificationQuestion[] {
    const memory = this.memories.get(sessionId);
    if (!memory) return [];

    const projectType = this.detectProjectType(sessionId);
    const context = memory.projectContext;
    const questions: ClarificationQuestion[] = [];

    // Universal questions
    if (!context.name) {
      questions.push({
        id: `q-${Date.now()}-1`,
        question: "What would you like to name this project?",
        field: 'name',
        priority: 'required',
        answered: false
      });
    }

    if (!context.startDate) {
      questions.push({
        id: `q-${Date.now()}-2`,
        question: "When would you like to start this project?",
        field: 'startDate',
        priority: 'required',
        options: ['Today', 'Next week', 'Next month', 'Custom date'],
        answered: false
      });
    }

    if (!context.duration && !context.endDate) {
      questions.push({
        id: `q-${Date.now()}-3`,
        question: "How long do you expect this project to take?",
        field: 'duration',
        priority: 'required',
        options: ['1-2 weeks', '3-4 weeks', '1-2 months', '3-6 months', 'Custom duration'],
        answered: false
      });
    }

    // Project-type specific questions
    if (projectType && PROJECT_TEMPLATES[projectType as keyof typeof PROJECT_TEMPLATES]) {
      const template = PROJECT_TEMPLATES[projectType as keyof typeof PROJECT_TEMPLATES];

      if (projectType === 'marketing_campaign' && !context.budget) {
        questions.push({
          id: `q-${Date.now()}-4`,
          question: "What's your budget for this marketing campaign?",
          field: 'budget',
          priority: 'optional',
          answered: false
        });
      }

      if (projectType === 'software_development' && !context.teamSize) {
        questions.push({
          id: `q-${Date.now()}-5`,
          question: "How many developers will be working on this project?",
          field: 'teamSize',
          priority: 'optional',
          answered: false
        });
      }
    }

    return questions;
  }

  // Clean up old sessions (> 24 hours)
  cleanupOldSessions(): void {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    Array.from(this.memories.entries()).forEach(([sessionId, memory]) => {
      if (memory.updatedAt < dayAgo) {
        this.memories.delete(sessionId);
      }
    });
  }

  // Plan snapshot storage for tracking latest plans per session
  private planSnapshots: Map<string, any> = new Map();

  // Save a plan snapshot for a session
  savePlanSnapshot(sessionId: string, plan: any): void {
    if (plan) {
      this.planSnapshots.set(sessionId, {
        plan,
        savedAt: new Date()
      });
    }
  }

  // Get the latest plan for a session
  getLatestPlan(sessionId: string): any | null {
    const snapshot = this.planSnapshots.get(sessionId);
    return snapshot?.plan || null;
  }

  // Clear plan snapshot for a session
  clearPlanSnapshot(sessionId: string): void {
    this.planSnapshots.delete(sessionId);
  }
}

// Export singleton instance
export const plannerMemory = new PlannerMemoryManager();