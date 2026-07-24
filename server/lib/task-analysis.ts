import OpenAI from "openai";
import { getAiClient } from "../services/ai-provider";
import { db } from "../db";
import { aiTools, taskToolRecommendations, tasks } from "@shared/schema";
import { and, eq, inArray as in_, sql } from "drizzle-orm";
import { ToolStatus } from "@shared/schema";
import { trackTokenUsage } from "../services/token-tracker";

const openai = (getAiClient() as any);

// Mapping of task types to potential tools and keywords
const taskTypeMapping: Record<string, { categories: string[], keywords: string[] }> = {
  "web development": {
    categories: ["Website Builder", "UI/UX Design", "Development", "Web Design"],
    keywords: ["website", "web page", "landing page", "html", "css", "javascript", "code", "frontend", "backend", "develop", "program"]
  },
  "content creation": {
    categories: ["Content Creation", "Research/Content Creation", "Writing Assistant", "Image Creation"],
    keywords: ["content", "blog", "article", "write", "copywriting", "post", "text", "story", "script"]
  },
  "design": {
    categories: ["Design", "Image Creation", "Image Editing", "UI/UX Design"],
    keywords: ["design", "logo", "visual", "mockup", "prototype", "layout", "color", "branding", "graphic"]
  },
  "marketing": {
    categories: ["Marketing", "Social Media", "Email Marketing"],
    keywords: ["marketing", "promote", "campaign", "ads", "advertising", "audience", "social media", "outreach"]
  },
  "project management": {
    categories: ["Project Management", "Collaboration", "Productivity"],
    keywords: ["manage", "task", "project", "track", "organize", "plan", "schedule", "team", "workflow", "progress"]
  },
  "automation": {
    categories: ["Automation"],
    keywords: ["automate", "workflow", "integration", "connect", "trigger", "action", "no-code"]
  },
  "finance": {
    categories: ["Finance"],
    keywords: ["finance", "accounting", "invoice", "payment", "bookkeeping", "tax", "budget", "expense"]
  },
  "legal": {
    categories: ["Legal"],
    keywords: ["legal", "contract", "agreement", "terms", "compliance", "policy", "document", "form"]
  },
  "analytics": {
    categories: ["Data Analysis"],
    keywords: ["analytics", "data", "measure", "metric", "statistic", "track", "report", "dashboard", "insight"]
  },
  "presentation": {
    categories: ["Presentation", "Storytelling"],
    keywords: ["presentation", "slide", "deck", "pitch", "demo", "showcase", "meeting"]
  },
  "transcription": {
    categories: ["Transcription", "Meeting Assistant"],
    keywords: ["transcribe", "recording", "audio", "speech", "voice", "meeting", "call", "conversation"]
  },
  "client management": {
    categories: ["Client Management", "CRM"],
    keywords: ["client", "customer", "lead", "crm", "relationship", "contact", "opportunity"]
  },
  "video": {
    categories: ["Video Creation", "Audio/Video Editing", "Video Outreach"],
    keywords: ["video", "edit", "footage", "film", "production", "animation", "clip", "movie"]
  },
  "research": {
    categories: ["Research", "Research/Content Creation", "Document Analysis", "General AI"],
    keywords: ["research", "analyze", "understand", "investigate", "explore", "learn", "discover", "information"]
  },
  "business planning": {
    categories: ["Business Strategy", "Business Planning", "Business Management", "Business Formation"],
    keywords: ["business", "plan", "strategy", "vision", "mission", "startup", "growth", "model", "revenue"]
  },
  "data collection": {
    categories: ["Data Collection", "Data Scraping"],
    keywords: ["collect", "data", "form", "survey", "questionnaire", "feedback", "input", "gather"]
  },
  "communication": {
    categories: ["Communication", "Collaboration"],
    keywords: ["communicate", "message", "chat", "email", "contact", "connect", "collaborate"]
  },
  "time management": {
    categories: ["Time Management", "Productivity"],
    keywords: ["time", "calendar", "schedule", "appointment", "reminder", "productivity", "efficiency"]
  }
};

/**
 * Analyzes a task using OpenAI to determine the task type and suggest appropriate tools
 * @param taskId The ID of the task to analyze
 */
export async function analyzeTask(taskId: number) {
  try {
    console.log(`Starting task analysis for task ID: ${taskId}`);
    
    // Get the task from the database
    const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (taskResult.length === 0) {
      throw new Error(`Task with ID ${taskId} not found.`);
    }
    
    const task = taskResult[0];
    console.log(`Found task: ${task.name}`);
    
    // Prepare task data for analysis
    const taskContent = {
      name: task.name,
      description: task.description || "",
    };
    
    // Use OpenAI to analyze the task
    console.log(`Running AI analysis for task: ${task.name}`);
    const analysis = await analyzeTaskWithAI(taskContent);
    console.log(`AI analysis completed. Task types: ${analysis.taskTypes.join(', ')}`);
    
    // Get tools that match the identified task types
    const recommendedTools = await findToolsForTaskTypes(analysis.taskTypes);
    console.log(`Found ${recommendedTools.length} recommended tools`);
    
    try {
      // Save tool recommendations to the database
      await saveToolRecommendations(taskId, recommendedTools);
      console.log(`Successfully saved tool recommendations`);
    } catch (saveError) {
      // If saving recommendations fails, log it but don't fail the entire analysis
      console.error(`Error saving recommendations but continuing with analysis:`, saveError);
      // We'll return the analysis even if saving fails
    }
    
    return { 
      taskId,
      analysis,
      recommendedTools
    };
  } catch (error: unknown) {
    console.error("Error analyzing task:", error);
    throw error;
  }
}

/**
 * Uses OpenAI API to analyze a task and determine its types
 */
async function analyzeTaskWithAI(taskContent: { name: string; description: string }) {
  try {
    const prompt = `
      Analyze the following task and categorize it into one or more of these categories: 
      web development, content creation, design, marketing, project management, automation, 
      finance, legal, analytics, presentation, transcription, client management, video, 
      research, business planning, data collection.
      
      Task name: ${taskContent.name}
      Task description: ${taskContent.description}
      
      Provide your response as a JSON object with the following structure:
      {
        "taskTypes": ["category1", "category2"], // Array of applicable categories from the list
        "reasoning": "Your explanation for why these categories apply"
      }
      
      Only include categories that strongly match the task description.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    if (response.usage) {
      trackTokenUsage("system", "task-analysis", "gpt-4o", response.usage).catch(() => {});
    }

    const analysisText = response.choices[0].message.content;
    if (!analysisText) {
      throw new Error("Received empty response from OpenAI");
    }

    const analysis = JSON.parse(analysisText);
    return {
      taskTypes: analysis.taskTypes as string[],
      reasoning: analysis.reasoning as string
    };
  } catch (error: unknown) {
    console.error("Error in OpenAI analysis:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to analyze task with AI: ${errorMessage}`);
  }
}

/**
 * Finds tools that match the identified task types
 */
async function findToolsForTaskTypes(taskTypes: string[]) {
  try {
    // Get relevant categories based on task types
    const relevantCategories = taskTypes.flatMap(type => {
      const mapping = taskTypeMapping[type.toLowerCase()];
      return mapping ? mapping.categories : [];
    });
    
    // If no relevant categories found, return empty array
    if (relevantCategories.length === 0) {
      return [];
    }
    
    // Query the database for tools in the relevant categories
    // Limit to 5 tools per task to avoid overwhelming the user
    const toolResults = await db
      .select()
      .from(aiTools)
      .where(in_(aiTools.category, relevantCategories))
      .limit(5);
    
    return toolResults;
  } catch (error: unknown) {
    console.error("Error finding tools for task types:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to find tools: ${errorMessage}`);
  }
}

/**
 * Saves tool recommendations to the database
 */
async function saveToolRecommendations(taskId: number, tools: typeof aiTools.$inferSelect[]) {
  try {
    console.log(`Saving tool recommendations for task ${taskId}. Tools count: ${tools.length}`);
    
    // Create recommendations for each tool
    const recommendations = tools.map(tool => ({
      taskId,
      toolId: tool.id,
      status: ToolStatus.SUGGESTED,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    // Insert the recommendations into the database using upsert pattern
    if (recommendations.length > 0) {
      for (const rec of recommendations) {
        console.log(`Processing recommendation for taskId=${rec.taskId}, toolId=${rec.toolId}`);
        try {
          await db.insert(taskToolRecommendations)
            .values(rec)
            .onConflictDoUpdate({
              target: [taskToolRecommendations.taskId, taskToolRecommendations.toolId],
              set: { status: rec.status, updatedAt: new Date() }
            });
          console.log(`Successfully saved/updated recommendation for tool ${rec.toolId}`);
        } catch (recError) {
          console.error(`Error processing individual recommendation:`, recError);
          // Continue with other recommendations instead of failing completely
        }
      }
    }
    
    console.log(`Completed saving ${recommendations.length} recommendations for task ${taskId}`);
    return recommendations.length;
  } catch (error: unknown) {
    console.error("Error saving tool recommendations:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save tool recommendations: ${errorMessage}`);
  }
}

/**
 * Updates the status of a tool recommendation
 */
export async function updateToolRecommendationStatus(
  taskId: number,
  toolId: number,
  status: ToolStatus
) {
  try {
    // Using the more reliable upsert pattern to handle conflict resolution
    await db
      .insert(taskToolRecommendations)
      .values({
        taskId,
        toolId,
        status,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [taskToolRecommendations.taskId, taskToolRecommendations.toolId],
        set: { status, updatedAt: new Date() }
      });
    
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating tool recommendation status:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update recommendation status: ${errorMessage}`);
  }
}

/**
 * Gets all tool recommendations for a task
 */
export async function getToolRecommendationsForTask(taskId: number) {
  try {
    // Join the recommendations with the tools to get the complete data
    const recommendations = await db
      .select({
        recommendation: taskToolRecommendations,
        tool: aiTools
      })
      .from(taskToolRecommendations)
      .innerJoin(aiTools, eq(taskToolRecommendations.toolId, aiTools.id))
      .where(eq(taskToolRecommendations.taskId, taskId));
    
    return recommendations;
  } catch (error: unknown) {
    console.error("Error getting tool recommendations for task:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get tool recommendations: ${errorMessage}`);
  }
}

/**
 * Analyzes task content and returns dynamic tool recommendations
 */
export async function analyzeTaskContent(taskContent: { name: string; description: string }) {
  try {
    console.log(`Analyzing task content: ${taskContent.name}`);
    
    // Analyze the task content to determine task types
    const analysis = await analyzeTaskWithAI(taskContent);
    console.log(`Task analysis completed. Task types: ${analysis.taskTypes.join(', ')}`);
    
    // Find tools based on the identified task types
    const tools = await findToolsForTaskTypes(analysis.taskTypes);
    console.log(`Found ${tools.length} recommended tools`);
    
    // Return in the same format as getToolRecommendationsForTask
    const recommendations = tools.map(tool => ({
      recommendation: {
        taskId: null, // Dynamic recommendations don't have a stored taskId
        toolId: tool.id,
        status: 'suggested',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      tool
    }));
    
    return recommendations;
  } catch (error: unknown) {
    console.error("Error analyzing task content:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to analyze task content: ${errorMessage}`);
  }
}