import OpenAI from 'openai';
import { getAiClient, userHasOwnKey } from "./services/ai-provider";
import { trackTokenUsage } from './services/token-tracker';
import { persistMemory } from './services/agent-memory';
import type { Task, InsertTaskPriorityScore, TaskPriorityScore } from '@shared/schema';

const openai = (getAiClient() as any);

interface TaskWithEffort extends Task {
  effortEstimate?: number; // estimated hours
}

interface PriorityAnalysis {
  task_id: string;
  priority_score: number; // 1-10 scale
  roi: "high" | "medium" | "low";
  effort: "high" | "medium" | "low"; 
  urgency: "high" | "medium" | "low";
  strategic_fit: "high" | "medium" | "low";
  recommendation: string;
  confidence: number; // 0-100
  reasoning: string;
}

interface WeightingProfile {
  roiWeight: number; // 0-100
  effortWeight: number; // 0-100
  urgencyWeight: number; // 0-100
  strategicWeight: number; // 0-100
}

const DEFAULT_WEIGHTING_PROFILES: Record<string, WeightingProfile> = {
  'speed': { roiWeight: 15, effortWeight: 45, urgencyWeight: 35, strategicWeight: 5 },
  'roi': { roiWeight: 50, effortWeight: 20, urgencyWeight: 15, strategicWeight: 15 },
  'balanced': { roiWeight: 25, effortWeight: 25, urgencyWeight: 25, strategicWeight: 25 }
};

export async function prioritizeTasksWithGPT(
  tasks: TaskWithEffort[],
  weightingProfile: WeightingProfile = DEFAULT_WEIGHTING_PROFILES.balanced,
  contextInfo?: {
    projectName?: string;
    projectDescription?: string;
    businessGoals?: string;
  },
  /** Optional. When supplied, the call is logged to long-term memory. */
  userId?: string,
): Promise<PriorityAnalysis[]> {
  if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(userId))) {
    throw new Error('No AI provider configured. Add your own Claude key in Settings, or ask an admin to configure the platform key.');
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  // Prepare context for GPT
  const taskContext = tasks.map(task => ({
    id: task.id.toString(),
    title: task.name,
    description: task.description || 'No description provided',
    currentPriority: task.priority || 'medium',
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null,
    status: task.status,
    effortEstimate: task.effortEstimate || null,
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString().split('T')[0] : null
  }));

  const weightingContext = `
Priority Weighting Configuration:
- ROI Impact: ${weightingProfile.roiWeight}%
- Effort Required: ${weightingProfile.effortWeight}%
- Urgency/Timing: ${weightingProfile.urgencyWeight}%
- Strategic Alignment: ${weightingProfile.strategicWeight}%
`;

  const projectContext = contextInfo ? `
Project Context:
- Name: ${contextInfo.projectName || 'Not specified'}
- Description: ${contextInfo.projectDescription || 'Not specified'}
- Business Goals: ${contextInfo.businessGoals || 'Not specified'}
` : '';

  const systemPrompt = `You are an intelligent project prioritization assistant. Analyze each task for ROI potential, effort required, urgency based on due dates, and strategic fit. 

${weightingContext}
${projectContext}

Guidelines for Analysis:
- ROI (Return on Investment): Consider business value, revenue impact, user benefit, competitive advantage
- Effort: Assess complexity, time required, resources needed, technical challenges
- Urgency: Factor in due dates, dependencies, time-sensitive opportunities
- Strategic Fit: Evaluate alignment with business goals, long-term vision, core objectives

Priority Score Scale (1-10):
- 9-10: Critical, must do immediately
- 7-8: High priority, do soon
- 5-6: Medium priority, schedule appropriately  
- 3-4: Low priority, do when capacity allows
- 1-2: Nice to have, lowest priority

Return structured JSON with analysis for each task. Be specific and actionable in recommendations.`;

  const userPrompt = `Analyze and prioritize these ${tasks.length} project tasks:

${JSON.stringify(taskContext, null, 2)}

Return a JSON array with priority analysis for each task.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 4000
    });

    if (response.usage) {
      trackTokenUsage("system", "task-prioritization-v1", "gpt-4o", response.usage).catch(() => {});
    }

    const analysisResult = JSON.parse(response.choices[0].message.content || '{}');

    // Long-term memory log.
    void persistMemory({
      ctx: { userId, agentName: 'prioritisor-agent', retrieve: false },
      userQuery: `Prioritize ${tasks.length} tasks${contextInfo?.projectName ? ' for ' + contextInfo.projectName : ''}`,
      agentResponse: response.choices[0].message.content || '',
    });

    // Handle both array and object responses
    let analyses: PriorityAnalysis[] = [];
    if (Array.isArray(analysisResult)) {
      analyses = analysisResult;
    } else if (analysisResult.tasks && Array.isArray(analysisResult.tasks)) {
      analyses = analysisResult.tasks;
    } else if (analysisResult.analysis && Array.isArray(analysisResult.analysis)) {
      analyses = analysisResult.analysis;
    } else {
      throw new Error('Unexpected response format from GPT');
    }

    // Validate and normalize the response
    return analyses.map(analysis => ({
      task_id: analysis.task_id,
      priority_score: Math.max(1, Math.min(10, Math.round(analysis.priority_score || 5))),
      roi: normalizeLevel(analysis.roi),
      effort: normalizeLevel(analysis.effort),
      urgency: normalizeLevel(analysis.urgency),
      strategic_fit: normalizeLevel(analysis.strategic_fit),
      recommendation: analysis.recommendation || 'No specific recommendation provided',
      confidence: Math.max(0, Math.min(100, analysis.confidence || 85)),
      reasoning: analysis.reasoning || analysis.recommendation || 'Analysis provided by AI'
    }));

  } catch (error) {
    console.error('Error in GPT prioritization:', error);
    throw new Error(`Failed to analyze tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function normalizeLevel(level: string): "high" | "medium" | "low" {
  if (!level) return "medium";
  const normalized = level.toLowerCase().trim();
  if (normalized.includes('high') || normalized.includes('critical') || normalized.includes('urgent')) return "high";
  if (normalized.includes('low') || normalized.includes('minimal') || normalized.includes('easy')) return "low";
  return "medium";
}

export function calculateAdjustedPriorityScore(
  baseScore: number,
  roiLevel: string,
  effortLevel: string,
  urgencyLevel: string,
  strategicLevel: string,
  weights: WeightingProfile
): number {
  const levelToScore = {
    'high': 1.0,
    'medium': 0.6,
    'low': 0.2
  };

  const roiScore = levelToScore[roiLevel as keyof typeof levelToScore] || 0.6;
  const effortScore = 1 - (levelToScore[effortLevel as keyof typeof levelToScore] || 0.6); // Inverse for effort
  const urgencyScore = levelToScore[urgencyLevel as keyof typeof levelToScore] || 0.6;
  const strategicScore = levelToScore[strategicLevel as keyof typeof levelToScore] || 0.6;

  const weightedScore = (
    (roiScore * weights.roiWeight) +
    (effortScore * weights.effortWeight) +
    (urgencyScore * weights.urgencyWeight) +
    (strategicScore * weights.strategicWeight)
  ) / 100;

  // Combine with base AI score
  return Math.min(10, Math.max(1, baseScore * 0.7 + weightedScore * 10 * 0.3));
}