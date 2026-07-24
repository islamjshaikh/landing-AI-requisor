import OpenAI from "openai";
import { getAiClient } from "./ai-provider";
import { storage } from "../storage";
import { trackTokenUsage } from "./token-tracker";
import { persistMemory } from "./agent-memory";
import { Task, Project, InsertBudgetEstimate, InsertBudgetLineItem } from "@shared/schema";

interface BudgetEstimationRequest {
  projectId: number;
  clientInfo?: {
    name?: string;
    email?: string;
    company?: string;
  };
  customRates?: {
    [role: string]: number; // in cents per hour
  };
}

interface EstimatedLineItem {
  taskId?: number;
  category: string;
  description: string;
  role: string;
  hours: number;
  rate: number; // in cents
  totalAmount: number; // in cents
}

interface BudgetEstimationResult {
  lineItems: EstimatedLineItem[];
  totalAmount: number;
  categorySummary: {
    [category: string]: {
      hours: number;
      amount: number;
    };
  };
}

// Tabal Chocolate reference data for estimation accuracy
const TABAL_REFERENCE_DATA = {
  rates: {
    developer: 8500, // $85/hour in cents
    designer: 7500,  // $75/hour
    manager: 9500,   // $95/hour
    qa: 6500,        // $65/hour
    copywriter: 5500, // $55/hour
  },
  taskPatterns: {
    "ui design": { category: "Design", role: "designer", baseHours: 8 },
    "frontend development": { category: "Development", role: "developer", baseHours: 16 },
    "backend development": { category: "Development", role: "developer", baseHours: 20 },
    "database": { category: "Development", role: "developer", baseHours: 12 },
    "api": { category: "Development", role: "developer", baseHours: 10 },
    "testing": { category: "QA", role: "qa", baseHours: 6 },
    "project management": { category: "Management", role: "manager", baseHours: 4 },
    "content creation": { category: "Content", role: "copywriter", baseHours: 4 },
    "research": { category: "Planning", role: "manager", baseHours: 3 },
    "deployment": { category: "DevOps", role: "developer", baseHours: 4 },
  }
};

export class BudgetAgent {
  private openai: OpenAI;

  constructor() {
    // No hard OPENAI_API_KEY requirement: getAiClient() resolves the provider
    // per user at call time (own Claude key or platform default).
    this.openai = (getAiClient() as any);
  }

  async estimateProjectBudget(
    request: BudgetEstimationRequest,
    /** Optional. When supplied, the call is logged to long-term memory. */
    userId?: string,
  ): Promise<BudgetEstimationResult> {
    console.log("BudgetAgent: Starting budget estimation for project", request.projectId);
    
    // Get project and tasks
    const project = await storage.getProject(request.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    console.log("BudgetAgent: Found project:", project.name);

    const tasks = await storage.getTasksByProjectId(request.projectId);
    console.log("BudgetAgent: Found", tasks.length, "tasks");

    // Temporarily use fallback estimation directly for testing
    console.log("BudgetAgent: Using fallback estimation for testing");
    return this.fallbackEstimation(tasks, request.customRates || {});
    
    /* TODO: Re-enable AI analysis once testing is complete
    try {
      // Use AI to analyze tasks and generate estimates
      const estimation = await this.analyzeTasksWithAI(project, tasks, request.customRates || {});
      console.log("BudgetAgent: AI analysis completed successfully");
      return estimation;
    } catch (error) {
      console.error("BudgetAgent: AI analysis failed, falling back to rule-based estimation:", error);
      // Fallback to rule-based estimation if AI fails
      return this.fallbackEstimation(tasks, request.customRates || {});
    }
    */
  }

  private async analyzeTasksWithAI(
    project: Project, 
    tasks: Task[], 
    customRates: { [role: string]: number }
  ): Promise<BudgetEstimationResult> {
    const taskDescriptions = tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description || "",
      priority: task.priority || "medium"
    }));

    const prompt = `
As a professional project estimation expert, analyze these project tasks and provide detailed effort estimates.

Project: "${project.name}"
Description: "${project.description || "No description provided"}"

Tasks to estimate:
${JSON.stringify(taskDescriptions, null, 2)}

Reference Data from Past Projects (Tabal Chocolate):
${JSON.stringify(TABAL_REFERENCE_DATA, null, 2)}

Custom Rates (if provided):
${JSON.stringify(customRates, null, 2)}

Please provide a JSON response with effort estimates for each task. For each task, determine:
1. Most appropriate role (developer, designer, manager, qa, copywriter)
2. Category (Development, Design, QA, Management, Content, Planning, DevOps)
3. Estimated hours based on complexity and similar past work
4. Apply appropriate hourly rate

Consider:
- Task complexity and scope
- Dependencies between tasks
- Industry standards for similar work
- Use Tabal reference data as baseline but adjust for current project context

Return JSON format:
{
  "estimates": [
    {
      "taskId": number,
      "category": "string",
      "description": "string",
      "role": "string", 
      "hours": number,
      "reasoning": "string"
    }
  ]
}
`;

    try {
      console.log("BudgetAgent: Making OpenAI API call...");
      
      // Add timeout wrapper for OpenAI call
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("OpenAI request timeout")), 30000)
      );
      
      const openaiPromise = this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert project estimator with deep experience in software development, design, and project management. Provide accurate, realistic estimates based on industry standards and past project data."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for more consistent estimates
      });
      
      const response = await Promise.race([openaiPromise, timeoutPromise]) as Awaited<ReturnType<typeof this.openai.chat.completions.create>>;

      if (response.usage) {
        trackTokenUsage("system", "budget-estimation", "gpt-4o", response.usage).catch(() => {});
      }

      const aiResult = JSON.parse(response.choices[0].message.content || "{}");

      // Long-term memory log (no retrieval — this is a one-shot transformer).
      void persistMemory({
        ctx: {
          userId,
          agentName: "budget-agent",
          retrieve: false,
          projectId: request.projectId,
        },
        userQuery: `Estimate budget for project ${request.projectId}`,
        agentResponse: response.choices[0].message.content || "",
      });

      // Convert AI estimates to budget line items
      const lineItems: EstimatedLineItem[] = [];
      const categorySummary: { [category: string]: { hours: number; amount: number } } = {};
      let totalAmount = 0;

      for (const estimate of aiResult.estimates || []) {
        const rate = customRates[estimate.role] || TABAL_REFERENCE_DATA.rates[estimate.role as keyof typeof TABAL_REFERENCE_DATA.rates] || 7500;
        const amount = estimate.hours * rate;

        const lineItem: EstimatedLineItem = {
          taskId: estimate.taskId,
          category: estimate.category,
          description: estimate.description,
          role: estimate.role,
          hours: estimate.hours,
          rate: rate,
          totalAmount: amount
        };

        lineItems.push(lineItem);
        totalAmount += amount;

        // Update category summary
        if (!categorySummary[estimate.category]) {
          categorySummary[estimate.category] = { hours: 0, amount: 0 };
        }
        categorySummary[estimate.category].hours += estimate.hours;
        categorySummary[estimate.category].amount += amount;
      }

      return {
        lineItems,
        totalAmount,
        categorySummary
      };

    } catch (error) {
      console.error("AI estimation failed:", error);
      
      // Fallback to pattern-based estimation
      return this.fallbackEstimation(tasks, customRates);
    }
  }

  private fallbackEstimation(tasks: Task[], customRates: { [role: string]: number }): BudgetEstimationResult {
    const lineItems: EstimatedLineItem[] = [];
    const categorySummary: { [category: string]: { hours: number; amount: number } } = {};
    let totalAmount = 0;

    for (const task of tasks) {
      const taskText = `${task.name} ${task.description || ""}`.toLowerCase();
      
      // Find matching pattern
      let bestMatch = { category: "Development", role: "developer", baseHours: 8 };
      for (const [pattern, config] of Object.entries(TABAL_REFERENCE_DATA.taskPatterns)) {
        if (taskText.includes(pattern)) {
          bestMatch = config;
          break;
        }
      }

      const rate = customRates[bestMatch.role] || TABAL_REFERENCE_DATA.rates[bestMatch.role as keyof typeof TABAL_REFERENCE_DATA.rates] || 7500;
      const hours = bestMatch.baseHours;
      const amount = hours * rate;

      const lineItem: EstimatedLineItem = {
        taskId: task.id,
        category: bestMatch.category,
        description: task.name,
        role: bestMatch.role,
        hours: hours,
        rate: rate,
        totalAmount: amount
      };

      lineItems.push(lineItem);
      totalAmount += amount;

      // Update category summary
      if (!categorySummary[bestMatch.category]) {
        categorySummary[bestMatch.category] = { hours: 0, amount: 0 };
      }
      categorySummary[bestMatch.category].hours += hours;
      categorySummary[bestMatch.category].amount += amount;
    }

    return {
      lineItems,
      totalAmount,
      categorySummary
    };
  }

  async saveBudgetEstimate(
    estimation: BudgetEstimationResult,
    projectId: number,
    userId: string,
    clientInfo?: any,
    additionalInfo?: any
  ): Promise<number> {
    // Create budget estimate
    const budgetData: InsertBudgetEstimate = {
      projectId,
      name: `Budget Estimate - ${new Date().toLocaleDateString()}`,
      description: additionalInfo?.description || "AI-generated budget estimate",
      totalAmount: estimation.totalAmount,
      clientName: clientInfo?.name,
      clientEmail: clientInfo?.email,
      clientCompany: clientInfo?.company,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      terms: additionalInfo?.terms || "Standard terms and conditions apply",
      createdBy: userId,
    };

    const budget = await storage.createBudgetEstimate(budgetData);

    // Create line items
    for (let i = 0; i < estimation.lineItems.length; i++) {
      const item = estimation.lineItems[i];
      const lineItemData: InsertBudgetLineItem = {
        budgetId: budget.id,
        taskId: item.taskId,
        category: item.category,
        description: item.description,
        quantity: 1,
        rate: item.rate,
        hours: item.hours,
        totalAmount: item.totalAmount,
        role: item.role,
        position: i,
      };

      await storage.createBudgetLineItem(lineItemData);
    }

    return budget.id;
  }
}