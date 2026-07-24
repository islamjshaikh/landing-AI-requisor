import OpenAI from "openai";
import { getAiClient } from "./services/ai-provider";
import { trackTokenUsage } from "./services/token-tracker";
import {
  plannerMemory,
  ProjectContext,
  ClarificationQuestion,
  PROJECT_TEMPLATES,
} from "./project-planner-memory";
import {
  recallMemory,
  formatMemoryForPrompt,
  persistMemory,
  type AgentMemoryContext,
} from "./services/agent-memory";

const openai = (getAiClient() as any);

interface DeepAgentResponse {
  content: string;
  projectCanvas?: any;
  clarifications?: ClarificationQuestion[];
  suggestions?: string[];
  extractedContext?: Partial<ProjectContext>;
  confidence: number;
}

export class DeepIntelligenceAgent {
  private sessionId: string | null = null;

  async initSession(userId: string): Promise<string> {
    this.sessionId = plannerMemory.createSession(userId);
    return this.sessionId;
  }

  async processMessage(
    message: string,
    sessionId: string,
  ): Promise<DeepAgentResponse> {
    this.sessionId = sessionId;
    const memory = plannerMemory.getSession(sessionId);

    if (!memory) {
      throw new Error("Session not found");
    }

    // Memory context — persistent layer keyed off the planner-memory userId.
    const memCtx: AgentMemoryContext = {
      userId: (memory as any)?.userId ?? null,
      agentName: "deep-intelligence-agent",
      sessionId,
      retrieve: true,
      compress: true,
    };
    // Fire-and-forget persistence of the user turn. Response side is
    // captured by the callsite that owns the final return value (in routes.ts).
    void persistMemory({ ctx: memCtx, userQuery: message });
    const recall = await recallMemory(message, memCtx);
    const _memoryHeader = formatMemoryForPrompt(recall);
    // Note: _memoryHeader is currently advisory; v2 of this agent applies it
    // directly to the model system prompt. v1 retains it for callers that
    // want to inspect what was retrieved.
    void _memoryHeader;

    // Extract context from message
    const extractedContext = await this.extractProjectInfo(message);
    plannerMemory.updateContext(sessionId, extractedContext);

    // Detect project type
    const projectType = plannerMemory.detectProjectType(sessionId);

    // Check for missing critical information
    const clarifications =
      plannerMemory.generateMissingInfoQuestions(sessionId);
    const unansweredQuestions = clarifications.filter((q) => !q.answered);

    // If we have unanswered required questions, ask them first
    if (unansweredQuestions.some((q) => q.priority === "required")) {
      const nextQuestion = unansweredQuestions.find(
        (q) => q.priority === "required",
      );
      return {
        content: nextQuestion!.question,
        clarifications: [nextQuestion!],
        confidence: 0.5,
      };
    }

    // If we have enough information, generate the project plan
    const hasEnoughInfo = this.hasMinimumInfo(memory.projectContext);

    if (
      hasEnoughInfo ||
      message.toLowerCase().includes("create") ||
      message.toLowerCase().includes("generate")
    ) {
      const projectPlan = await this.generateEnhancedProjectPlan(
        memory.projectContext,
        projectType,
      );

      // Add conversation turn to memory
      plannerMemory.addConversationTurn(sessionId, {
        userMessage: message,
        assistantResponse: "Generated project plan",
        extractedInfo: extractedContext,
        timestamp: new Date(),
      });

      return {
        content: this.generatePlanSummary(projectPlan, memory.projectContext),
        projectCanvas: projectPlan,
        suggestions: this.generateSuggestions(projectPlan, projectType),
        confidence: 0.9,
      };
    }

    // Otherwise, continue gathering information
    return {
      content: this.generateContextualResponse(memory.projectContext, message),
      clarifications: unansweredQuestions,
      extractedContext,
      confidence: 0.7,
    };
  }

  private async extractProjectInfo(
    message: string,
  ): Promise<Partial<ProjectContext>> {
    const prompt = `Extract project information from this message. Return a JSON object with any of these fields if mentioned:
    - name: project name
    - type: project type (marketing, software, onboarding, etc.)
    - startDate: start date if mentioned
    - duration: project duration
    - teamSize: number of team members
    - budget: budget amount
    - owner: project owner name
    - description: project description

    Message: "${message}"

    Only include fields that are explicitly mentioned. Return empty object {} if no information found.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a project information extractor. Extract only explicitly mentioned information.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      if (completion.usage) {
        trackTokenUsage("system", "deep-agent-extract", "gpt-4o-mini", completion.usage).catch(() => {});
      }

      return JSON.parse(completion.choices[0].message.content || "{}");
    } catch (error) {
      console.error("Error extracting project info:", error);
      return {};
    }
  }

  private hasMinimumInfo(context: ProjectContext): boolean {
    // Check if we have at least name and one of: duration, dates, or type
    return !!(
      context.name &&
      (context.duration || context.startDate || context.endDate || context.type)
    );
  }

  private async generateEnhancedProjectPlan(
    context: ProjectContext,
    projectType: string | null,
  ): Promise<any> {
    const template =
      projectType &&
      PROJECT_TEMPLATES[projectType as keyof typeof PROJECT_TEMPLATES];

    const systemPrompt = `You are an expert project planner with deep knowledge of ${projectType || "various"} projects.
    ${template ? `Use these best practices for ${projectType} projects: ${JSON.stringify(template)}` : ""}

    Create a comprehensive, highly specific project plan that:
    1. Includes industry-specific tasks and terminology
    2. Has realistic timelines based on project complexity
    3. Identifies dependencies between tasks
    4. Suggests optimal team structure
    5. Highlights potential risks and mitigation strategies
    6. Includes quality checkpoints and review cycles

    The plan should feel like it was created by a seasoned ${projectType || "project"} manager who knows all the nuances.`;

    const userPrompt = `Create a detailed project plan with the following context:
    ${JSON.stringify(context, null, 2)}

    Generate a plan with:
    - Specific, actionable tasks (not generic)
    - Realistic dates starting from ${context.startDate || "today"}
    - Duration: ${context.duration || "1-3 months"}
    - Clear dependencies and sequencing
    - Risk mitigation built into the timeline

    Return as JSON with milestones and tasks structure.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 3000,
      });

      if (completion.usage) {
        trackTokenUsage("system", "deep-agent-plan", "gpt-4o", completion.usage).catch(() => {});
      }

      const plan = JSON.parse(completion.choices[0].message.content || "{}");

      // Enhance with additional metadata
      plan.projectType = projectType;
      plan.confidence = 0.9;
      plan.suggestedTeamSize = context.teamSize || this.calculateTeamSize(plan);
      plan.estimatedBudget = context.budget || this.estimateBudget(plan);
      plan.risks = this.identifyRisks(plan, context);

      return plan;
    } catch (error) {
      console.error("Error generating enhanced plan:", error);
      throw error;
    }
  }

  private generatePlanSummary(plan: any, context: ProjectContext): string {
    const milestoneCount = plan.milestones?.length || 0;
    const taskCount =
      plan.milestones?.reduce(
        (total: number, m: any) => total + (m.tasks?.length || 0),
        0,
      ) || 0;

    let summary = `I've created a comprehensive project plan for "${plan.name || context.name}". `;
    summary += `The plan includes ${milestoneCount} major milestones and ${taskCount} specific tasks. `;

    if (plan.projectType) {
      summary += `\n\nThis ${plan.projectType} project follows industry best practices with:`;
      const template =
        PROJECT_TEMPLATES[plan.projectType as keyof typeof PROJECT_TEMPLATES];
      if (template) {
        summary += `\n• ${template.phases.join(" → ")}`;
      }
    }

    if (plan.risks && plan.risks.length > 0) {
      summary += `\n\n⚠️ Key risks identified: ${plan.risks.slice(0, 2).join(", ")}`;
    }

    summary += `\n\nYou can review and edit all details before saving to your projects.`;

    return summary;
  }

  private generateSuggestions(plan: any, projectType: string | null): string[] {
    const suggestions: string[] = [];

    // Check for missing best practices
    if (projectType === "software_development" && !this.hasTestingPhase(plan)) {
      suggestions.push(
        "Consider adding a dedicated QA/Testing phase before deployment",
      );
    }

    if (projectType === "marketing_campaign" && !this.hasAnalyticsSetup(plan)) {
      suggestions.push(
        "Add analytics and tracking setup tasks early in the project",
      );
    }

    // Check for compressed timeline
    if (this.isTimelineTooAggressive(plan)) {
      suggestions.push(
        "The timeline seems aggressive - consider adding buffer time between major milestones",
      );
    }

    // Check for missing documentation
    if (!this.hasDocumentationTasks(plan)) {
      suggestions.push(
        "Include documentation tasks to ensure knowledge transfer",
      );
    }

    return suggestions;
  }

  private generateContextualResponse(
    context: ProjectContext,
    message: string,
  ): string {
    const hasName = !!context.name;
    const hasType = !!context.type;
    const hasTiming = !!(context.startDate || context.duration);

    if (!hasName) {
      return "I'd be happy to help you create a project plan! What would you like to name this project?";
    }

    if (!hasType && !this.isProjectTypeObvious(context.name)) {
      return `Great! "${context.name}" sounds interesting. What type of project is this? (e.g., software development, marketing campaign, product launch, client onboarding)`;
    }

    if (!hasTiming) {
      return `Perfect! For "${context.name}", when would you like to start, and how long do you expect it to take?`;
    }

    return `I have the key details for "${context.name}". Would you like me to generate a comprehensive project plan now, or would you like to provide any additional context?`;
  }

  // Helper methods
  private calculateTeamSize(plan: any): number {
    const taskCount =
      plan.milestones?.reduce(
        (total: number, m: any) => total + (m.tasks?.length || 0),
        0,
      ) || 0;

    if (taskCount < 20) return 2;
    if (taskCount < 50) return 3;
    if (taskCount < 100) return 5;
    return 8;
  }

  private estimateBudget(plan: any): number {
    // Simple estimation based on duration and complexity
    const weeks = this.calculateDurationInWeeks(plan);
    const complexity = this.assessComplexity(plan);

    const baseRate = 10000; // Base weekly rate
    const complexityMultiplier =
      complexity === "complex" ? 2 : complexity === "moderate" ? 1.5 : 1;

    return Math.round(weeks * baseRate * complexityMultiplier);
  }

  private identifyRisks(plan: any, context: ProjectContext): string[] {
    const risks: string[] = [];

    if (this.isTimelineTooAggressive(plan)) {
      risks.push("Aggressive timeline may lead to quality issues");
    }

    if (!context.teamSize || context.teamSize < this.calculateTeamSize(plan)) {
      risks.push("Team size may be insufficient for project scope");
    }

    if (this.hasExternalDependencies(plan)) {
      risks.push("External dependencies could cause delays");
    }

    return risks;
  }

  private hasTestingPhase(plan: any): boolean {
    return (
      plan.milestones?.some(
        (m: any) =>
          m.name.toLowerCase().includes("test") ||
          m.name.toLowerCase().includes("qa"),
      ) || false
    );
  }

  private hasAnalyticsSetup(plan: any): boolean {
    return (
      plan.milestones?.some((m: any) =>
        m.tasks?.some(
          (t: any) =>
            t.name.toLowerCase().includes("analytics") ||
            t.name.toLowerCase().includes("tracking"),
        ),
      ) || false
    );
  }

  private hasDocumentationTasks(plan: any): boolean {
    return (
      plan.milestones?.some((m: any) =>
        m.tasks?.some(
          (t: any) =>
            t.name.toLowerCase().includes("document") ||
            t.name.toLowerCase().includes("guide"),
        ),
      ) || false
    );
  }

  private isTimelineTooAggressive(plan: any): boolean {
    const taskCount =
      plan.milestones?.reduce(
        (total: number, m: any) => total + (m.tasks?.length || 0),
        0,
      ) || 0;
    const weeks = this.calculateDurationInWeeks(plan);

    return taskCount / weeks > 10; // More than 10 tasks per week is aggressive
  }

  private calculateDurationInWeeks(plan: any): number {
    if (!plan.startDate || !plan.endDate) return 4; // Default

    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

    return diffWeeks || 4;
  }

  private assessComplexity(plan: any): "simple" | "moderate" | "complex" {
    const taskCount =
      plan.milestones?.reduce(
        (total: number, m: any) => total + (m.tasks?.length || 0),
        0,
      ) || 0;

    if (taskCount < 20) return "simple";
    if (taskCount < 50) return "moderate";
    return "complex";
  }

  private hasExternalDependencies(plan: any): boolean {
    const dependencyKeywords = [
      "vendor",
      "third-party",
      "external",
      "partner",
      "supplier",
    ];

    return (
      plan.milestones?.some((m: any) =>
        dependencyKeywords.some(
          (keyword) =>
            m.name.toLowerCase().includes(keyword) ||
            m.tasks?.some((t: any) => t.name.toLowerCase().includes(keyword)),
        ),
      ) || false
    );
  }

  private isProjectTypeObvious(projectName?: string): boolean {
    if (!projectName) return false;

    const name = projectName.toLowerCase();
    const typeKeywords = [
      "marketing",
      "campaign",
      "software",
      "app",
      "website",
      "launch",
      "onboarding",
      "migration",
      "integration",
    ];

    return typeKeywords.some((keyword) => name.includes(keyword));
  }
}

export const deepAgent = new DeepIntelligenceAgent();
