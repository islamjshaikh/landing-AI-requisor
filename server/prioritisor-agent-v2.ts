import OpenAI from 'openai';
import { getAiClient, userHasOwnKey } from "./services/ai-provider";
import { trackTokenUsage } from './services/token-tracker';
import { persistMemory } from './services/agent-memory';

const openai = (getAiClient() as any);

interface Task {
  id: number;
  name: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  projectId?: number;
  createdAt: string;
  progress?: number;
}

interface WeightingProfile {
  roiWeight: number;
  effortWeight: number;
  urgencyWeight: number;
  strategicWeight: number;
  dependencyWeight: number;
}

interface PrioritizedTask extends Task {
  priorityScore: number;
  roiLevel: 'high' | 'medium' | 'low';
  effortLevel: 'high' | 'medium' | 'low';
  urgencyLevel: 'high' | 'medium' | 'low';
  strategicFit: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence: number;
}

export async function prioritizeTasksV2(
  tasks: Task[],
  weightingProfile: WeightingProfile,
  /** Optional. When supplied, the call is logged to long-term memory. */
  userId?: string,
): Promise<PrioritizedTask[]> {
  console.log('[prioritizeTasksV2] Starting with', tasks?.length || 0, 'tasks');
  console.log('[prioritizeTasksV2] Weighting profile:', weightingProfile);
  
  if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey(userId))) {
    console.error('[prioritizeTasksV2] No AI provider configured');
    throw new Error('No AI provider configured. Add your own Claude key in Settings, or ask an admin to configure the platform key.');
  }

  if (!tasks || tasks.length === 0) {
    console.log('[prioritizeTasksV2] No tasks provided, returning empty array');
    return [];
  }

  // Prepare tasks for GPT analysis
  const taskList = tasks.map(task => ({
    id: task.id,
    name: task.name,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    progress: task.progress || 0,
    createdAt: task.createdAt
  }));

  const systemPrompt = `You are an intelligent task prioritization agent. Analyze tasks based on multiple factors and provide priority scores.

SCORING METHODOLOGY:
- ROI Level: Assess potential business value and user impact
  * High = Critical for revenue/adoption/user satisfaction
  * Medium = Moderate business value
  * Low = Nice to have, minimal immediate impact

- Effort Level: Estimate implementation complexity and time
  * Low = Quick win (< 1 day)
  * Medium = Moderate effort (1-3 days)
  * High = Significant effort (> 3 days)

- Urgency Level: Consider deadlines and blocking factors
  * High = Due soon or blocking other work
  * Medium = Should be done within sprint
  * Low = Can be deferred

- Strategic Fit: Alignment with long-term goals
  * High = Core to product vision
  * Medium = Supports strategic objectives
  * Low = Peripheral to main goals

PRIORITY SCORE CALCULATION:
Use the following weights to calculate a 1-10 priority score:
- ROI Impact: ${weightingProfile.roiWeight}%
- Effort (favor low effort): ${weightingProfile.effortWeight}%
- Urgency: ${weightingProfile.urgencyWeight}%
- Strategic Alignment: ${weightingProfile.strategicWeight}%
- Dependencies: ${weightingProfile.dependencyWeight}%

Higher scores (8-10) = Do immediately
Medium scores (5-7) = Schedule soon
Lower scores (1-4) = Defer or delegate

RECOMMENDATIONS:
Provide actionable, specific recommendations like:
- "Tackle in first sprint - quick win with high impact"
- "Schedule for next release - requires significant effort"
- "Defer until dependencies resolved"
- "Perfect for junior developer - low complexity"`;

  const userPrompt = `Analyze these ${tasks.length} tasks and provide prioritization:

${JSON.stringify(taskList, null, 2)}

IMPORTANT: Return a JSON object with a "tasks" array containing the analysis for ALL ${tasks.length} tasks.
{
  "tasks": [
    {
      "id": <task_id>,
      "priorityScore": <number 1-10>,
      "roiLevel": "high" | "medium" | "low",
      "effortLevel": "high" | "medium" | "low",
      "urgencyLevel": "high" | "medium" | "low",
      "strategicFit": "high" | "medium" | "low",
      "recommendation": "<specific actionable recommendation>",
      "confidence": <number 70-100>
    }
  ]
}

Make sure to include ALL ${tasks.length} tasks in your response.`;

  try {
    console.log('[prioritizeTasksV2] Calling OpenAI API for task prioritization...');
    console.log('[prioritizeTasksV2] Task list being sent:', JSON.stringify(taskList, null, 2).substring(0, 500));
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    if (completion.usage) {
      trackTokenUsage("system", "task-prioritization", "gpt-4o", completion.usage).catch(() => {});
    }

    const response = completion.choices[0].message.content;
    console.log('[prioritizeTasksV2] OpenAI response received:', response ? 'Yes' : 'No');

    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Long-term memory log.
    void persistMemory({
      ctx: { userId, agentName: 'prioritisor-agent-v2', retrieve: false },
      userQuery: `Prioritize ${tasks.length} tasks (v2)`,
      agentResponse: response,
    });

    // Parse the response
    let analysisResults;
    try {
      console.log('[prioritizeTasksV2] Raw OpenAI response:', response.substring(0, 500));
      const parsed = JSON.parse(response);
      console.log('[prioritizeTasksV2] Parsed response type:', Array.isArray(parsed) ? 'array' : 'object');
      console.log('[prioritizeTasksV2] Parsed response keys:', Object.keys(parsed));
      
      // Handle if response is wrapped in an object
      analysisResults = Array.isArray(parsed) ? parsed : (parsed.tasks || parsed.prioritizedTasks || parsed.analysis || []);
      console.log('[prioritizeTasksV2] Analysis results found:', analysisResults.length);
    } catch (parseError) {
      console.error('[prioritizeTasksV2] Failed to parse OpenAI response:', response);
      console.error('[prioritizeTasksV2] Parse error:', parseError);
      throw new Error('Invalid response format from AI');
    }

    // Merge analysis results with original tasks
    const prioritizedTasks: PrioritizedTask[] = tasks.map(task => {
      const analysis = analysisResults.find((a: any) => a.id === task.id);
      
      if (analysis) {
        return {
          ...task,
          priorityScore: analysis.priorityScore || 5,
          roiLevel: analysis.roiLevel || 'medium',
          effortLevel: analysis.effortLevel || 'medium',
          urgencyLevel: analysis.urgencyLevel || 'medium',
          strategicFit: analysis.strategicFit || 'medium',
          recommendation: analysis.recommendation || 'Review task details for better prioritization',
          confidence: analysis.confidence || 75
        };
      }
      
      // Fallback for tasks not analyzed
      return {
        ...task,
        priorityScore: 5,
        roiLevel: 'medium' as const,
        effortLevel: 'medium' as const,
        urgencyLevel: 'medium' as const,
        strategicFit: 'medium' as const,
        recommendation: 'Unable to analyze - review manually',
        confidence: 50
      };
    });

    console.log(`Successfully prioritized ${prioritizedTasks.length} tasks`);
    return prioritizedTasks;

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    // Return tasks with default prioritization if API fails
    return tasks.map(task => ({
      ...task,
      priorityScore: 5,
      roiLevel: 'medium' as const,
      effortLevel: 'medium' as const,
      urgencyLevel: 'medium' as const,
      strategicFit: 'medium' as const,
      recommendation: 'AI analysis unavailable - manual review needed',
      confidence: 0
    }));
  }
}