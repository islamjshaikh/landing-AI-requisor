import OpenAI from "openai";
import { getAiClient, userHasOwnKey } from "./ai-provider";
import { Task, TeamMember } from "@shared/schema";
import { trackTokenUsage } from "./token-tracker";

const openai = (getAiClient() as any);

export interface SmartAssignment {
  taskId: number;
  taskTitle: string;
  taskDescription: string;
  recommendation: {
    type: 'human' | 'ai' | 'hybrid';
    assignee?: string;
    teamMemberId?: number;
    confidence: number;
    reasoning: string;
    estimatedCompletion: string;
    costSavings?: number;
  };
  alternativeOptions: Array<{
    type: 'human' | 'ai';
    assignee?: string;
    teamMemberId?: number;
    confidence: number;
    pros: string[];
    cons: string[];
  }>;
}

export interface CapacityMetrics {
  totalCapacity: number;
  allocatedCapacity: number;
  availableCapacity: number;
  utilizationRate: number;
  potentialSavings: number;
}

export async function generateSmartAssignments(
  tasks: Task[],
  teamMembers: TeamMember[]
): Promise<SmartAssignment[]> {
  console.log(`Generating smart assignments for ${tasks.length} tasks and ${teamMembers.length} team members`);
  
  if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
    console.log("No AI provider configured, using fallback assignments");
    return generateFallbackAssignments(tasks, teamMembers);
  }

  try {
    const assignments: SmartAssignment[] = [];

    // Process tasks in batches to avoid token limits
    for (const task of tasks) {
      const assignment = await analyzeTaskForAssignment(task, teamMembers);
      assignments.push(assignment);
    }

    console.log(`Generated ${assignments.length} smart assignments`);
    return assignments;
  } catch (error) {
    console.error("Error generating AI assignments:", error);
    return generateFallbackAssignments(tasks, teamMembers);
  }
}

async function analyzeTaskForAssignment(
  task: Task,
  teamMembers: TeamMember[]
): Promise<SmartAssignment> {
  const prompt = `
Analyze this task for optimal assignment to team members or AI tools:

TASK:
- Title: ${task.name}
- Description: ${task.description}
- Priority: ${task.priority}
- Status: ${task.status}
- Due Date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}

AVAILABLE TEAM MEMBERS:
${teamMembers.map(member => `
- ${member.name} (${member.role})
  - Skills: ${member.skills?.join(', ') || 'Not specified'}
  - Capacity: ${member.capacity}h/week (${member.availability}% available)
  - Performance: ${member.performance}/100
  - Rate: $${((member.hourlyRate || 0) / 100).toFixed(2)}/hour
  - Timezone: ${member.timezone}
`).join('')}

Based on the task requirements and team capacity, provide recommendations for:
1. Primary recommendation (human/AI/hybrid)
2. Alternative options
3. Cost and efficiency analysis

Consider factors like:
- Task complexity and creativity requirements
- Human expertise vs AI capabilities
- Time constraints and deadlines
- Cost efficiency
- Team member availability and skills
- Quality requirements

Respond in JSON format:
{
  "primaryRecommendation": {
    "type": "human|ai|hybrid",
    "assignee": "team member name or AI tool",
    "teamMemberId": "number or null",
    "confidence": "percentage 0-100",
    "reasoning": "detailed explanation",
    "estimatedCompletion": "time estimate",
    "costSavings": "estimated savings in cents if applicable"
  },
  "alternatives": [
    {
      "type": "human|ai",
      "assignee": "name",
      "teamMemberId": "number or null",
      "confidence": "percentage",
      "pros": ["benefit 1", "benefit 2"],
      "cons": ["drawback 1", "drawback 2"]
    }
  ]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    if (response.usage) {
      trackTokenUsage("system", "smart-assignments", "gpt-4o", response.usage).catch(() => {});
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis = JSON.parse(content);
    
    return {
      taskId: task.id,
      taskTitle: task.name,
      taskDescription: task.description || '',
      recommendation: {
        type: analysis.primaryRecommendation.type,
        assignee: analysis.primaryRecommendation.assignee,
        teamMemberId: analysis.primaryRecommendation.teamMemberId,
        confidence: analysis.primaryRecommendation.confidence,
        reasoning: analysis.primaryRecommendation.reasoning,
        estimatedCompletion: analysis.primaryRecommendation.estimatedCompletion,
        costSavings: analysis.primaryRecommendation.costSavings
      },
      alternativeOptions: analysis.alternatives || []
    };
  } catch (error) {
    console.error("Error analyzing task:", error);
    return generateFallbackTaskAssignment(task, teamMembers);
  }
}

function generateFallbackAssignments(
  tasks: Task[],
  teamMembers: TeamMember[]
): SmartAssignment[] {
  console.log(`Generating fallback assignments for ${tasks.length} tasks`);
  
  // If no team members, create recommendations for AI vs manual assignment
  if (teamMembers.length === 0) {
    return tasks.map(task => generateAIOnlyTaskAssignment(task));
  }
  
  return tasks.map(task => generateFallbackTaskAssignment(task, teamMembers));
}

function generateAIOnlyTaskAssignment(task: Task): SmartAssignment {
  // Determine if task is suitable for AI based on keywords and complexity
  const taskContent = `${task.name} ${task.description || ''}`.toLowerCase();
  const aiKeywords = ['document', 'analysis', 'research', 'report', 'content', 'data', 'review'];
  const isAiSuitable = aiKeywords.some(keyword => taskContent.includes(keyword));
  
  const recommendationType = isAiSuitable ? 'ai' : 'human';
  const confidence = isAiSuitable ? 75 : 85;
  
  return {
    taskId: task.id,
    taskTitle: task.name,
    taskDescription: task.description || '',
    recommendation: {
      type: recommendationType,
      assignee: isAiSuitable ? 'AI Assistant' : 'Team Member Required',
      confidence,
      reasoning: isAiSuitable 
        ? 'This task involves documentation or analysis work that can be efficiently handled by AI tools, providing cost savings and quick turnaround.'
        : 'This task requires human creativity, decision-making, or domain expertise that is best handled by a skilled team member.',
      estimatedCompletion: isAiSuitable ? '2-4 hours' : '1-2 days',
      costSavings: isAiSuitable ? 25000 : 0, // $250 savings for AI tasks
    },
    alternativeOptions: [
      {
        type: isAiSuitable ? 'human' : 'ai',
        assignee: isAiSuitable ? 'Senior Team Member' : 'AI Tools',
        confidence: isAiSuitable ? 60 : 40,
        pros: isAiSuitable 
          ? ['Higher quality output', 'Better context understanding']
          : ['Faster completion', 'Lower cost'],
        cons: isAiSuitable 
          ? ['Higher cost', 'Longer timeline']
          : ['May need human review', 'Limited creativity']
      }
    ]
  };
}

function generateFallbackTaskAssignment(
  task: Task,
  teamMembers: TeamMember[]
): SmartAssignment {
  // Simple assignment logic based on availability and skills
  const availableMembers = teamMembers.filter(member => member.availability > 20);
  
  let bestMatch = availableMembers[0];
  let confidence = 60;
  
  if (availableMembers.length > 0) {
    // Sort by availability and performance
    availableMembers.sort((a, b) => {
      const scoreA = (a.availability * a.performance) / 100;
      const scoreB = (b.availability * b.performance) / 100;
      return scoreB - scoreA;
    });
    bestMatch = availableMembers[0];
    confidence = Math.min(90, bestMatch.availability + bestMatch.performance / 2);
  }

  const isAiSuitable = task.name.toLowerCase().includes('document') || 
                      task.name.toLowerCase().includes('analysis') ||
                      task.name.toLowerCase().includes('research');

  return {
    taskId: task.id,
    taskTitle: task.name,
    taskDescription: task.description || '',
    recommendation: {
      type: isAiSuitable ? 'ai' : 'human',
      assignee: isAiSuitable ? 'AI Assistant' : bestMatch?.name || 'Unassigned',
      teamMemberId: isAiSuitable ? undefined : bestMatch?.id,
      confidence,
      reasoning: isAiSuitable 
        ? 'Task appears suitable for AI automation based on keywords and description'
        : `Assigned to ${bestMatch?.name || 'available team member'} based on availability and performance metrics`,
      estimatedCompletion: '2-3 days',
      costSavings: isAiSuitable ? 50000 : 0 // $500 savings for AI tasks
    },
    alternativeOptions: [
      {
        type: isAiSuitable ? 'human' : 'ai',
        assignee: isAiSuitable ? bestMatch?.name || 'Team Member' : 'AI Assistant',
        teamMemberId: isAiSuitable ? bestMatch?.id : undefined,
        confidence: 40,
        pros: isAiSuitable 
          ? ['Human creativity', 'Quality control']
          : ['Fast execution', 'Cost effective'],
        cons: isAiSuitable 
          ? ['Higher cost', 'More time required']
          : ['Limited creativity', 'May need review']
      }
    ]
  };
}

export function calculateCapacityMetrics(teamMembers: TeamMember[]): CapacityMetrics {
  const totalCapacity = teamMembers.reduce((sum, member) => sum + (member.capacity || 0), 0);
  const allocatedCapacity = teamMembers.reduce((sum, member) => sum + (member.allocated || 0), 0);
  const availableCapacity = totalCapacity - allocatedCapacity;
  const utilizationRate = totalCapacity > 0 ? (allocatedCapacity / totalCapacity) * 100 : 0;
  
  // Estimate potential savings from AI automation
  const potentialSavings = teamMembers.reduce((sum, member) => {
    const underutilized = (member.capacity || 0) - (member.allocated || 0);
    return sum + (underutilized * (member.hourlyRate || 0));
  }, 0);

  return {
    totalCapacity,
    allocatedCapacity,
    availableCapacity,
    utilizationRate: Math.round(utilizationRate),
    potentialSavings
  };
}