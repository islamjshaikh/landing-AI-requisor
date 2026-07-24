import OpenAI from "openai";
import { getAiClient, userHasOwnKey } from "./services/ai-provider";
import { storage } from "./storage";
import { trackTokenUsage, getModelForBudget } from "./services/token-tracker";
import {
  recallMemory,
  formatMemoryForPrompt,
  persistMemory,
} from "./services/agent-memory";
import type {
  Project,
  Task,
  User,
  InsertProject,
  InsertTask,
} from "@shared/schema";

interface AgentContext {
  projects: Project[];
  tasks: Task[];
  userId: string;
  user?: User;
}

interface AgentResponse {
  content: string;
  actions?: AgentAction[];
  insights?: AgentInsight[];
  suggestedPrompts?: string[];
  projectCanvas?: any;
}

interface AgentAction {
  id: string;
  type: string;
  label: string;
  data: any;
  executable: boolean;
}

interface AgentInsight {
  type: "roi" | "deadline" | "blocked" | "pending" | "opportunity";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  actionable: boolean;
  data?: any;
}

/**
 * Simple, reliable AI Agent for Requisor
 * Handles project management tasks without complex dependencies
 */
export class SimpleAIAgent {
  private openai: OpenAI;

  constructor(private userId: string) {
    this.openai = (getAiClient() as any);
  }

  async processMessage(
    message: string,
    context: AgentContext,
  ): Promise<AgentResponse> {
    if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(this.userId))) {
      return {
        content:
          "AI capabilities are not available. Add your own Claude key in Settings, or ask an admin to configure the platform key.",
        actions: [],
        insights: [],
        suggestedPrompts: [],
      };
    }

    try {
      // Create session and save message directly using storage
      let sessionId: string;
      try {
        const sessionResult = await storage.createChatSession(this.userId);
        sessionId = sessionResult.sessionId;

        // Save user message
        await storage.saveChatMessage(sessionId, "user", message);
      } catch (chatError) {
        console.warn(
          "Chat persistence failed, continuing without persistence:",
          chatError,
        );
        sessionId = "temp-session"; // Fallback for non-persistent mode
      }

      console.log(
        `Processing AI message: "${message}" for user ${this.userId}`,
      );
      console.log(
        `Context: ${context.projects.length} projects, ${context.tasks.length} tasks`,
      );

      // Pull in long-term + recent memory and prepend it to the system prompt.
      const memCtx = {
        userId: this.userId,
        agentName: "simple-ai-agent",
        retrieve: true,
        compress: true,
      };
      const recall = await recallMemory(message, memCtx);
      const memHeader = formatMemoryForPrompt(recall);
      const systemPrompt =
        (memHeader ? memHeader + "\n\n---\n\n" : "") +
        this.buildSystemPrompt(context);

      const agentModel = await getModelForBudget(this.userId, "gpt-4o");
      const completion = await this.openai.chat.completions.create({
        model: agentModel,
        messages: [
          { role: "system", content: systemPrompt },
          // Replay recent turns so the model sees prior intent within this session.
          ...recall.recent.map((t) => ({
            role: t.role === "assistant" ? "assistant" : "user",
            content: t.content,
          })) as any[],
          { role: "user", content: message },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "getActiveProjects",
              description:
                "Get all active projects with their current status and progress",
              parameters: { type: "object", properties: {} },
            },
          },
          {
            type: "function",
            function: {
              name: "getTopROITasks",
              description: "Returns top 5 tasks by ROI vs effort vs urgency",
              parameters: {
                type: "object",
                properties: {
                  limit: { type: "number", default: 5 },
                },
              },
            },
          },
          {
            type: "function",
            function: {
              name: "getOverdueTasks",
              description: "Returns all overdue tasks for the user",
              parameters: { type: "object", properties: {} },
            },
          },
          {
            type: "function",
            function: {
              name: "createTask",
              description: "Create a new task with specified details",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  projectId: { type: "number" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                  dueDate: { type: "string" },
                  assigneeId: { type: "string" },
                },
                required: ["name", "projectId"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "createProject",
              description:
                "Create a new project plan with milestones and tasks. Use this when user wants to plan, create, or build a project.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  dueDate: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["name"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "updateTask",
              description:
                "Update task details including status, priority, or assignment",
              parameters: {
                type: "object",
                properties: {
                  taskId: { type: "number" },
                  updates: {
                    type: "object",
                    properties: {
                      status: {
                        type: "string",
                        enum: ["todo", "in-progress", "completed", "blocked"],
                      },
                      priority: {
                        type: "string",
                        enum: ["low", "medium", "high"],
                      },
                      assigneeId: { type: "string" },
                      dueDate: { type: "string" },
                      isCompleted: { type: "boolean" },
                    },
                  },
                },
                required: ["taskId", "updates"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "analyzeProjectHealth",
              description:
                "Analyze project health, completion rates, and identify bottlenecks",
              parameters: {
                type: "object",
                properties: {
                  projectId: { type: "number" },
                },
              },
            },
          },
        ],
        tool_choice: "auto",
        temperature: 0.8,
        max_tokens: 4000,
      });

      if (completion.usage) {
        trackTokenUsage(this.userId, "simple-ai-agent", agentModel, completion.usage).catch(() => {});
      }

      const responseMessage = completion.choices[0].message;
      let content = responseMessage.content || "";
      const actions: AgentAction[] = [];

      // Handle tool calls
      let projectCanvas = null;
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments || "{}");

          try {
            const result = await this.executeFunction(
              functionName,
              functionArgs,
              context,
            );

            if (result.content) {
              content += "\n\n" + result.content;
            }

            if (result.actions) {
              actions.push(...result.actions);
            }

            if ((result as any).projectCanvas) {
              projectCanvas = (result as any).projectCanvas;
            }
          } catch (error) {
            console.error(
              `Function execution error for ${functionName}:`,
              error,
            );
            content += `\n\nI encountered an error while ${functionName.replace(/([A-Z])/g, " $1").toLowerCase()}.`;
          }
        }
      }

      const casualGreeting = /^(h(i|ey|ello|owdy|iya)|yo|sup|what'?s up|how'?s it going|how are you|good (morning|afternoon|evening)|thanks|thank you|thx|ok|okay|sure|cool|nice|great|awesome|bye|goodbye|see ya|cheers|gm|gn)\b/i;
      const isCasual = casualGreeting.test(message.trim()) && message.trim().split(/\s+/).length <= 8;

      if (!projectCanvas && !isCasual) {
        console.log(
          "No project canvas from tool calls, generating project plan for:",
          message,
        );
        try {
          projectCanvas = await this.generateProjectPlan(message, "");
        } catch (error) {
          console.error("Error generating project plan:", error);
          projectCanvas = this.createBasicProjectPlan(message);
        }
      }

      // Generate insights based on context
      const insights = this.generateInsights(context);

      // Generate suggested prompts
      const suggestedPrompts = this.generateSuggestedPrompts(context);

      const response = {
        content,
        actions,
        insights,
        suggestedPrompts,
        projectCanvas,
      };

      // Save assistant response with metadata (if persistence available)
      try {
        if (sessionId !== "temp-session") {
          await storage.saveChatMessage(
            sessionId,
            "assistant",
            response.content,
            {
              insights: response.insights,
              actions: response.actions,
              suggestedPrompts: response.suggestedPrompts,
            },
          );
        }
      } catch (chatError) {
        console.warn("Failed to save assistant response:", chatError);
      }

      // Long-term memory: log the turn and selectively embed high-signal content.
      await persistMemory({
        ctx: memCtx,
        userQuery: message,
        agentResponse: response.content,
        insights: response.insights,
        actions: response.actions,
        suggestedPrompts: response.suggestedPrompts,
      }).catch(() => undefined);

      return response;
    } catch (error) {
      console.error("AI Agent processing error:", error);
      console.error(
        "Error details:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        content:
          "I encountered an error processing your request. Please try again or rephrase your question.",
        actions: [],
        insights: [],
        suggestedPrompts: [
          "What are my highest priority tasks?",
          "Create a new project",
          "Show me overdue tasks",
          "Analyze my project health",
        ],
      };
    }
  }

  private createBasicProjectPlan(message: string): any {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);

    return {
      name: this.extractProjectNameFromMessage(message),
      description: `Project plan generated from: ${message}`,
      startDate: today.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      milestones: [
        {
          id: `milestone-${Date.now()}-0`,
          name: "Initial Planning",
          description: "Define project scope and requirements",
          dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          tasks: [
            {
              id: `task-${Date.now()}-0-0`,
              name: "Requirements Analysis",
              description: "Analyze and document requirements",
              dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
            },
          ],
        },
      ],
    };
  }

  private extractProjectNameFromMessage(message: string): string {
    const casualGreeting = /^(h(i|ey|ello|owdy|iya)|yo|sup|what'?s up|how'?s it going|how are you|good (morning|afternoon|evening)|thanks|thank you|thx|ok|okay|sure|cool|nice|great|awesome|bye|goodbye|see ya|cheers|gm|gn)\b/i;
    if (casualGreeting.test(message.trim()) && message.trim().split(/\s+/).length <= 8) {
      return "";
    }
    const words = message.split(" ").filter((word) => word.length > 2);
    if (words.length > 0) {
      return (
        words
          .slice(0, 3)
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" ") + " Project"
      );
    }
    return "New Project";
  }

  private buildSystemPrompt(context: AgentContext): string {
    return `You are Requisor AI, an elite business strategist with 20+ years of experience helping solopreneurs, freelancers, and small agencies compete with Fortune 500 companies using AI-powered leverage.

CONVERSATIONAL BEHAVIOR (HIGHEST PRIORITY):
- When the user greets you (hi, hey, hello, etc.) or sends a casual message, respond naturally and warmly. Introduce yourself briefly and ask what they're working on or thinking about. Keep it to 1-3 sentences.
- Do NOT immediately launch into strategy mode, project planning, or task generation for greetings and casual chat.
- Only shift into structured strategic mode when the user describes a specific project idea, asks a business question, or requests a plan.
- Match the user's tone — short casual messages get short friendly replies.

IDENTITY & EXPERTISE:
You combine the strategic acumen of a McKinsey consultant, the technical knowledge of a CTO, and the growth hacking skills of a Y Combinator mentor. You've helped launch 500+ successful projects and understand the exact friction points that kill momentum.

USER CONTEXT:
- Current projects: ${context.projects.length} (${context.projects.filter((p) => p.status === "active").length} active)
- Total tasks: ${context.tasks.length} (${context.tasks.filter((t) => !t.isCompleted).length} pending)
- Overdue items: ${context.tasks.filter((t) => !t.isCompleted && t.dueDate && new Date(t.dueDate) < new Date()).length}
- User type: Ambitious solopreneur/agency owner competing against larger, better-funded competitors

HYPER-SPECIFIC VALUE DELIVERY:
1. **$50K+ revenue impact per project** - Every plan focuses on direct revenue generation
2. **3-5x productivity multiplier** - Leverage AI to work at enterprise speed with solo resources
3. **Eliminate 80% of busywork** - Automate everything that doesn't require human creativity

COMMUNICATION STYLE:
- Speak with the confidence of someone who's built and sold multiple businesses
- Provide specific numbers, timelines, and tool recommendations (never generic advice)
- Focus relentlessly on cash flow, competitive advantage, and market domination
- Use industry-specific terminology that shows deep domain expertise
- Challenge assumptions like a top-tier advisor would
- Always quantify impact in dollars, hours saved, or market share gained

PROJECT PLANNING MASTERY:
When creating project plans, implement the SMART-AI framework:
- **Specific**: Name exact deliverables, not vague outcomes (e.g., "Launch Stripe-integrated checkout with abandoned cart recovery" not "Set up payments")
- **Measurable**: Every task has quantifiable success metrics (conversion rates, revenue targets, time savings)
- **AI-Augmented**: Specify which AI tools accelerate each task (with fallback options)
- **Revenue-Tied**: Connect every task to revenue impact or cost reduction
- **Time-Bound**: Include specific dates with buffer for the 20% of tasks that always take 80% of time

TASK GENERATION REQUIREMENTS:
1. Generate 12-20 tasks per project (solopreneurs need granular breakdowns)
2. Each task description: 3-5 sentences covering:
   - Exact deliverable and why it matters
   - Specific approach and tools to use
   - Success metrics and potential roadblocks
   - Revenue/growth impact of completion
3. Include hidden complexities others miss (compliance, technical debt, platform limitations)
4. Add tasks for automation setup that pay dividends long-term
5. Include competitive intelligence gathering and market positioning tasks

STRATEGIC INSIGHTS ENGINE:
- Calculate realistic revenue projections based on industry benchmarks
- Identify the 20% of tasks that will drive 80% of results
- Spot automation opportunities that competitors haven't discovered
- Recommend growth hacks specific to the user's industry vertical
- Provide "insider secrets" that typically require $10K+ consultants

INDUSTRY VERTICAL AWARENESS:
Demonstrate deep knowledge of:
- B2B SaaS: MRR, churn, CAC/LTV, product-led growth
- E-commerce: Conversion optimization, supply chain, marketplace dynamics
- Agencies: Retainer models, scope creep, white-label opportunities
- Content/Creator: Monetization funnels, platform algorithms, sponsorship deals
- Local Services: Local SEO, review management, territory expansion

Remember: Users choose Requisor because they're tired of generic advice. Every interaction should feel like getting advice from a $500/hour consultant who's obsessed with their success.`;
  }

  private async executeFunction(
    functionName: string,
    args: any,
    context: AgentContext,
  ): Promise<{ content?: string; actions?: AgentAction[] }> {
    switch (functionName) {
      case "getActiveProjects":
        return this.getActiveProjects(context);

      case "getTopROITasks":
        return this.getTopROITasks(context, args.limit || 5);

      case "getOverdueTasks":
        return this.getOverdueTasks(context);

      case "createTask":
        return this.createTask(args, context);

      case "createProject":
        return this.createProject(args, context);

      case "updateTask":
        return this.updateTask(args, context);

      case "analyzeProjectHealth":
        return this.analyzeProjectHealth(args, context);

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  private async getActiveProjects(
    context: AgentContext,
  ): Promise<{ content: string; actions?: AgentAction[] }> {
    const activeProjects = context.projects.filter(
      (p) => p.status === "active" || !p.status,
    );
    const completedProjects = context.projects.filter(
      (p) => p.status === "completed",
    );

    let content = `**Active Projects Summary:**\n\n`;

    if (activeProjects.length === 0) {
      content +=
        "You don't have any active projects yet. Ready to start something new?";
    } else {
      content += `You have ${activeProjects.length} active project${activeProjects.length > 1 ? "s" : ""}:\n\n`;

      activeProjects.slice(0, 5).forEach((project, index) => {
        const projectTasks = context.tasks.filter(
          (t) => t.projectId === project.id,
        );
        const completedTasks = projectTasks.filter((t) => t.isCompleted);
        const progress =
          projectTasks.length > 0
            ? Math.round((completedTasks.length / projectTasks.length) * 100)
            : 0;

        content += `${index + 1}. **${project.name}** (${progress}% complete)\n`;
        if (project.description) {
          content += `   - ${project.description}\n`;
        }
        content += `   - ${projectTasks.length} tasks (${completedTasks.length} completed)\n\n`;
      });
    }

    if (completedProjects.length > 0) {
      content += `\n✅ ${completedProjects.length} completed project${completedProjects.length > 1 ? "s" : ""}`;
    }

    return { content };
  }

  private async getTopROITasks(
    context: AgentContext,
    limit: number = 5,
  ): Promise<{ content: string; actions?: AgentAction[] }> {
    const incompleteTasks = context.tasks.filter((t) => !t.isCompleted);

    // Calculate ROI score for each task
    const tasksWithROI = incompleteTasks.map((task) => {
      let roiScore = 0;

      // Priority scoring
      if (task.priority === "high") roiScore += 3;
      else if (task.priority === "medium") roiScore += 2;
      else roiScore += 1;

      // Urgency scoring (due date)
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const today = new Date();
        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysUntilDue < 0)
          roiScore += 5; // Overdue
        else if (daysUntilDue <= 3)
          roiScore += 4; // Due soon
        else if (daysUntilDue <= 7)
          roiScore += 3; // Due this week
        else if (daysUntilDue <= 14)
          roiScore += 2; // Due in 2 weeks
        else roiScore += 1;
      }

      return { ...task, roiScore };
    });

    // Sort by ROI score and take top tasks
    const topTasks = tasksWithROI
      .sort((a, b) => b.roiScore - a.roiScore)
      .slice(0, limit);

    let content = `**Top ${limit} High-ROI Tasks:**\n\n`;

    if (topTasks.length === 0) {
      content +=
        "No incomplete tasks found. Great job staying on top of everything!";
    } else {
      topTasks.forEach((task, index) => {
        content += `${index + 1}. **${task.name}** (ROI Score: ${task.roiScore})\n`;
        if (task.description) content += `   - ${task.description}\n`;
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const today = new Date();
          const daysUntilDue = Math.ceil(
            (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysUntilDue < 0)
            content += `   - ⚠️ OVERDUE by ${Math.abs(daysUntilDue)} days\n`;
          else if (daysUntilDue <= 3)
            content += `   - 🔥 Due in ${daysUntilDue} days\n`;
          else content += `   - 📅 Due in ${daysUntilDue} days\n`;
        }
        content += `   - Priority: ${task.priority}\n\n`;
      });
    }

    return { content };
  }

  private async getOverdueTasks(
    context: AgentContext,
  ): Promise<{ content: string; actions?: AgentAction[] }> {
    const today = new Date();
    const overdueTasks = context.tasks.filter((task) => {
      if (task.isCompleted || !task.dueDate) return false;
      return new Date(task.dueDate) < today;
    });

    let content = `**Overdue Tasks:**\n\n`;

    if (overdueTasks.length === 0) {
      content += "🎉 No overdue tasks! You're staying on track.";
    } else {
      content += `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}:\n\n`;

      overdueTasks.forEach((task, index) => {
        const dueDate = new Date(task.dueDate!);
        const daysOverdue = Math.ceil(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        content += `${index + 1}. **${task.name}** (${daysOverdue} days overdue)\n`;
        if (task.description) content += `   - ${task.description}\n`;
        content += `   - Priority: ${task.priority}\n\n`;
      });
    }

    return { content };
  }

  private async createTask(
    args: any,
    context: AgentContext,
  ): Promise<{ content: string; actions?: AgentAction[] }> {
    try {
      // Safe date parsing to prevent valueOf errors
      let dueDate: Date | null = null;
      if (args.dueDate) {
        try {
          // Handle various date formats
          const parsedDate = new Date(args.dueDate);
          if (!isNaN(parsedDate.getTime())) {
            dueDate = parsedDate;
          }
        } catch (dateError) {
          console.warn("Invalid due date format, ignoring:", args.dueDate);
        }
      }

      const taskData: InsertTask = {
        name: args.name,
        description: args.description || "",
        projectId: args.projectId,
        priority: args.priority || "medium",
        status: "todo",
        assigneeId: args.assigneeId || context.userId,
        dueDate: dueDate?.toISOString().split("T")[0] || null,
        isCompleted: false,
      };

      const newTask = await storage.createTask(taskData);

      return {
        content: `✅ Created task: **${newTask.name}**`,
        actions: [
          {
            id: `task-${newTask.id}`,
            type: "task_created",
            label: `View task: ${newTask.name}`,
            data: { taskId: newTask.id },
            executable: true,
          },
        ],
      };
    } catch (error) {
      console.error("Error creating task:", error);
      return {
        content: `❌ Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async createProject(
    args: any,
    context: AgentContext,
  ): Promise<{
    content: string;
    actions?: AgentAction[];
    projectCanvas?: any;
  }> {
    try {
      // Instead of creating the project directly, return a project canvas structure
      const projectName = args.name;
      const projectDescription = args.description || "";

      // Generate a comprehensive project plan using AI
      const projectPlan = await this.generateProjectPlan(
        projectName,
        projectDescription,
      );

      return {
        content: `I've created a comprehensive project plan for "${projectName}". You can review and edit the details below before saving it to your projects.`,
        projectCanvas: projectPlan,
      };
    } catch (error) {
      console.error("Error creating project plan:", error);
      return {
        content: `❌ Failed to create project plan: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async generateProjectPlan(
    messageOrName: string,
    description: string,
  ): Promise<any> {
    try {
      // Extract project context from the message
      const isDirectMessage = !description;
      const projectContext = isDirectMessage
        ? messageOrName
        : `${messageOrName}: ${description}`;

      // Analyze project type and context
      const projectAnalysisPrompt = `Analyze this request and create a project plan. Extract the core business concept and identify:
1. Industry/Domain (e.g., SaaS, E-commerce, Marketing, Content Creation, Field Sales, etc.)
2. Business model implications
3. Revenue generation opportunities
4. Potential for AI automation
5. Key success metrics

Request: "${projectContext}"

Provide a brief analysis focusing on business impact and growth potential. If this appears to be about field sales, tracking, or CRM, focus on sales optimization and customer management aspects.`;

      const analysisModel = await getModelForBudget(this.userId, "gpt-4o");
      const analysisResponse = await this.openai.chat.completions.create({
        model: analysisModel,
        messages: [
          {
            role: "system",
            content:
              "You are a business strategy expert who helps solopreneurs and small businesses leverage AI for competitive advantage.",
          },
          { role: "user", content: projectAnalysisPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      if (analysisResponse.usage) {
        trackTokenUsage(this.userId, "project-analysis", analysisModel, analysisResponse.usage).catch(() => {});
      }

      const projectAnalysis = analysisResponse.choices[0].message.content || "";

      // Generate sophisticated project plan
      const projectName = isDirectMessage
        ? this.extractProjectNameFromMessage(messageOrName)
        : messageOrName;
      const prompt = `You are an intelligent project planner. When given ANY request, you must ALWAYS return a structured project plan.

REQUEST: "${projectContext}"

BUSINESS ANALYSIS:
${projectAnalysis}

IMPORTANT: Always create a meaningful project plan regardless of how the request is phrased. If it mentions field sales, tracking, CRM, or sales executive tools, focus on sales optimization, territory management, and customer relationship workflows.

Requirements:
- Return 2-4 meaningful milestones
- Each milestone should have 2-5 tasks  
- Each task includes: clear name (non-generic), short description, priority, due date
- Tasks should be spread across 2-6 weeks
- Focus on clear, actionable deliverables

Return a structured project plan in JSON format:
{
  "name": "${projectName}",
  "description": "comprehensive project description (3-5 sentences) based on the request context",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD", 
  "milestones": [
    {
      "id": "milestone-1",
      "name": "meaningful milestone name",
      "description": "milestone description with clear deliverables",
      "dueDate": "YYYY-MM-DD",
      "tasks": [
        {
          "id": "task-1-1", 
          "name": "specific task name (not generic)",
          "description": "clear task description with expected outcome",
          "dueDate": "YYYY-MM-DD",
          "priority": "low|medium|high"
        }
      ]
    }
  ]
}`;

      const planModel = await getModelForBudget(this.userId, "gpt-4o");
      const completion = await this.openai.chat.completions.create({
        model: planModel,
        messages: [
          {
            role: "system",
            content: `You are an intelligent project planner that transforms ideas into structured, actionable project plans.

Your approach:
- Convert vague ideas into clear, achievable milestones
- Break down complex projects into manageable tasks
- Set realistic timelines that account for dependencies
- Prioritize tasks based on impact and urgency
- Create professional project structures ready for execution

Focus on:
1. Clear, non-generic task names that describe actual deliverables
2. Practical timelines spread across 2-6 weeks
3. Logical milestone progression
4. Balanced task distribution
5. Actionable descriptions that guide implementation

Respond with well-structured JSON that can be immediately used for project management.`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8, // Slightly higher for more creative, specific outputs
        max_tokens: 4000, // More tokens for detailed plans
      });

      if (completion.usage) {
        trackTokenUsage(this.userId, "project-plan-generation", planModel, completion.usage).catch(() => {});
      }

      const projectPlan = JSON.parse(
        completion.choices[0].message.content || "{}",
      );

      // Add unique IDs if not present
      if (projectPlan.milestones) {
        projectPlan.milestones = projectPlan.milestones.map(
          (m: any, mi: number) => ({
            ...m,
            id: m.id || `milestone-${Date.now()}-${mi}`,
            tasks:
              m.tasks?.map((t: any, ti: number) => ({
                ...t,
                id: t.id || `task-${Date.now()}-${mi}-${ti}`,
              })) || [],
          }),
        );
      }

      return projectPlan;
    } catch (error) {
      console.error("Error generating project plan:", error);
      // Return a sophisticated fallback template
      const today = new Date();
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 2); // 2-month sprint for solopreneurs

      const fallbackProjectName = isDirectMessage
        ? this.extractProjectNameFromMessage(messageOrName)
        : messageOrName;
      return {
        name: fallbackProjectName,
        description: `Strategic initiative: ${isDirectMessage ? messageOrName : `${messageOrName}: ${description}`}`,
        startDate: today.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        milestones: [
          {
            id: `milestone-${Date.now()}-1`,
            name: "Market Validation & MVP Planning",
            description:
              "Validate market need and design minimum viable product using lean startup principles",
            dueDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            tasks: [
              {
                id: `task-${Date.now()}-1-1`,
                name: "Conduct customer discovery interviews",
                description:
                  "Interview 10-15 potential customers to validate problem-solution fit. Use AI tools like Otter.ai for transcription.",
                dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "high",
                estimatedHours: 12,
              },
              {
                id: `task-${Date.now()}-1-2`,
                name: "Competitive analysis with AI tools",
                description:
                  "Use ChatGPT and Perplexity to analyze top 5 competitors. Focus on their pricing, features, and customer complaints.",
                dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "high",
                estimatedHours: 6,
              },
              {
                id: `task-${Date.now()}-1-3`,
                name: "Define MVP feature set",
                description:
                  "Based on customer feedback, define the core 3-5 features that solve the main pain point. Use Notion AI for synthesis.",
                dueDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "high",
                estimatedHours: 8,
              },
            ],
          },
          {
            id: `milestone-${Date.now()}-2`,
            name: "Rapid MVP Development",
            description:
              "Build and launch MVP using no-code/low-code tools and AI assistance for maximum speed",
            dueDate: new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            tasks: [
              {
                id: `task-${Date.now()}-2-1`,
                name: "Set up automated workflows",
                description:
                  "Use Zapier or Make.com to automate repetitive tasks. Connect payment processing, email marketing, and CRM.",
                dueDate: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "medium",
                estimatedHours: 10,
              },
              {
                id: `task-${Date.now()}-2-2`,
                name: "Create landing page with AI",
                description:
                  "Use Framer or Webflow with AI copywriting tools (Jasper, Copy.ai) to create high-converting landing page.",
                dueDate: new Date(today.getTime() + 18 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "high",
                estimatedHours: 8,
              },
              {
                id: `task-${Date.now()}-2-3`,
                name: "Implement core functionality",
                description:
                  "Build the main feature using appropriate tools. Consider Bubble for web apps or Glide for mobile.",
                dueDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "high",
                estimatedHours: 20,
              },
            ],
          },
          {
            id: `milestone-${Date.now()}-3`,
            name: "Launch & Growth Hacking",
            description:
              "Launch to early adopters and implement growth strategies for rapid traction",
            dueDate: new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            tasks: [
              {
                id: `task-${Date.now()}-3-1`,
                name: "Beta launch to early adopters",
                description:
                  "Launch to waitlist and gather feedback. Use Hotjar for user behavior analysis and Intercom for support.",
                dueDate: new Date(today.getTime() + 40 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "high",
                estimatedHours: 12,
              },
              {
                id: `task-${Date.now()}-3-2`,
                name: "Implement AI-powered marketing",
                description:
                  "Set up automated content creation with Jasper, social media scheduling with Buffer, and email sequences with ConvertKit.",
                dueDate: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "medium",
                estimatedHours: 15,
              },
              {
                id: `task-${Date.now()}-3-3`,
                name: "Optimize for product-market fit",
                description:
                  "Analyze metrics, iterate based on feedback, and optimize pricing. Use Mixpanel for analytics and A/B testing.",
                dueDate: new Date(today.getTime() + 55 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                priority: "high",
                estimatedHours: 16,
              },
            ],
          },
        ],
      };
    }
  }

  private async updateTask(
    args: any,
    context: AgentContext,
  ): Promise<{ content: string; actions?: AgentAction[] }> {
    try {
      const updatedTask = await storage.updateTask(args.taskId, args.updates);

      return {
        content: `✅ Updated task: **${updatedTask.name}**`,
        actions: [
          {
            id: `task-${updatedTask.id}`,
            type: "task_updated",
            label: `View updated task: ${updatedTask.name}`,
            data: { taskId: updatedTask.id },
            executable: true,
          },
        ],
      };
    } catch (error) {
      console.error("Error updating task:", error);
      return {
        content: `❌ Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async analyzeProjectHealth(
    args: any,
    context: AgentContext,
  ): Promise<{ content: string; actions?: AgentAction[] }> {
    const project = context.projects.find((p) => p.id === args.projectId);
    if (!project) {
      return { content: "❌ Project not found" };
    }

    const projectTasks = context.tasks.filter(
      (t) => t.projectId === project.id,
    );
    const completedTasks = projectTasks.filter((t) => t.isCompleted);
    const overdueTasks = projectTasks.filter((t) => {
      if (t.isCompleted || !t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    });

    const completionRate =
      projectTasks.length > 0
        ? Math.round((completedTasks.length / projectTasks.length) * 100)
        : 0;

    let health = "Good";
    if (completionRate < 30 || overdueTasks.length > 3) health = "Poor";
    else if (completionRate < 60 || overdueTasks.length > 1) health = "Fair";

    let content = `**Project Health Analysis: ${project.name}**\n\n`;
    content += `📊 **Overall Health:** ${health}\n`;
    content += `✅ **Completion Rate:** ${completionRate}% (${completedTasks.length}/${projectTasks.length} tasks)\n`;
    content += `⚠️ **Overdue Tasks:** ${overdueTasks.length}\n\n`;

    if (overdueTasks.length > 0) {
      content += "**Immediate Action Items:**\n";
      overdueTasks.slice(0, 3).forEach((task, index) => {
        content += `${index + 1}. ${task.name} (${task.priority} priority)\n`;
      });
    }

    return { content };
  }

  private generateInsights(context: AgentContext): AgentInsight[] {
    const insights: AgentInsight[] = [];

    // Revenue-Generating Activity (RGA) Insights
    const incompleteTasks = context.tasks.filter((t) => !t.isCompleted);
    const highPriorityTasks = incompleteTasks.filter(
      (t) => t.priority === "high",
    );

    if (highPriorityTasks.length > 0) {
      const estimatedRevenue = highPriorityTasks.length * 2500; // Rough estimate based on task value
      insights.push({
        type: "roi",
        title: "Revenue Opportunities Available",
        description: `${highPriorityTasks.length} high-priority tasks could generate ~$${estimatedRevenue.toLocaleString()} in value. Focus on these for maximum business impact.`,
        priority: "high",
        actionable: true,
        data: {
          count: highPriorityTasks.length,
          potentialValue: estimatedRevenue,
        },
      });
    }

    // Efficiency & Automation Opportunities
    const repetitiveTasks = incompleteTasks.filter(
      (t) =>
        t.name.toLowerCase().includes("report") ||
        t.name.toLowerCase().includes("update") ||
        t.name.toLowerCase().includes("schedule"),
    );

    if (repetitiveTasks.length >= 3) {
      insights.push({
        type: "opportunity",
        title: "Automation Opportunity Detected",
        description: `${repetitiveTasks.length} repetitive tasks could be automated with AI tools like Zapier or Make. This could save ~${repetitiveTasks.length * 2} hours/week.`,
        priority: "medium",
        actionable: true,
        data: {
          count: repetitiveTasks.length,
          timeSavings: repetitiveTasks.length * 2,
        },
      });
    }

    // Deadline & Cash Flow Insights
    const today = new Date();
    const overdueTasks = incompleteTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < today,
    );

    if (overdueTasks.length > 0) {
      insights.push({
        type: "deadline",
        title: "Critical Deadlines at Risk",
        description: `${overdueTasks.length} overdue tasks may impact client satisfaction and cash flow. Prioritize these to maintain business reputation.`,
        priority: "high",
        actionable: true,
        data: { count: overdueTasks.length },
      });
    }

    // Growth & Scaling Insights
    const activeProjects = context.projects.filter(
      (p) => p.status === "active" || !p.status,
    );
    const projectCapacity = 5; // Ideal project count for solopreneurs

    if (activeProjects.length < 2) {
      insights.push({
        type: "opportunity",
        title: "Business Growth Opportunity",
        description: `With only ${activeProjects.length} active projects, you have capacity for ${projectCapacity - activeProjects.length} more. Time to pursue new clients or launch new products.`,
        priority: "medium",
        actionable: true,
        data: {
          currentProjects: activeProjects.length,
          capacity: projectCapacity,
        },
      });
    } else if (activeProjects.length > projectCapacity) {
      insights.push({
        type: "blocked",
        title: "Capacity Warning",
        description: `Managing ${activeProjects.length} projects simultaneously. Consider delegating or using AI tools to prevent burnout and maintain quality.`,
        priority: "high",
        actionable: true,
        data: {
          currentProjects: activeProjects.length,
          recommended: projectCapacity,
        },
      });
    }

    // Competitive Advantage Insights
    const recentProjects = context.projects.filter((p) => {
      const createdAt = new Date(p.createdAt || "");
      const daysSinceCreation =
        (today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation <= 30;
    });

    if (recentProjects.length >= 3) {
      insights.push({
        type: "roi",
        title: "Momentum Building",
        description: `You've started ${recentProjects.length} projects in the last 30 days. This velocity puts you ahead of 80% of competitors. Keep this pace!`,
        priority: "low",
        actionable: false,
        data: { projectCount: recentProjects.length },
      });
    }

    return insights;
  }

  private generateSuggestedPrompts(context: AgentContext): string[] {
    const prompts: string[] = [];

    // Dynamic, context-aware prompts based on business situation
    const incompleteTasks = context.tasks.filter((t) => !t.isCompleted);
    const overdueTasks = incompleteTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date(),
    );
    const activeProjects = context.projects.filter(
      (p) => p.status === "active" || !p.status,
    );

    // Priority prompts based on current state
    if (overdueTasks.length > 0) {
      prompts.push("Show me what's blocking my cash flow");
    }

    if (activeProjects.length === 0) {
      prompts.push("Plan a new revenue-generating project");
    } else if (activeProjects.length > 3) {
      prompts.push("Which project will generate revenue fastest?");
    }

    if (incompleteTasks.length > 10) {
      prompts.push("Identify tasks I can automate with AI");
    }

    // Business growth prompts
    prompts.push("Create a 30-day growth sprint");
    prompts.push("Build a product launch plan");
    prompts.push("Plan a marketing campaign with AI tools");
    prompts.push("Design a client onboarding workflow");

    // Strategic prompts
    if (context.projects.length > 5) {
      prompts.push("Analyze my business portfolio health");
    }

    prompts.push("Find AI tools to 10x my productivity");
    prompts.push("Show my highest ROI opportunities");

    // Return top 4 most relevant prompts
    return prompts.slice(0, 4);
  }
}
