import OpenAI from 'openai';
import { getAiClient } from "./services/ai-provider";
import { storage } from './storage';
import { trackTokenUsage, getModelForBudget } from './services/token-tracker';
import { persistMemory } from './services/agent-memory';
import type { InsertOnboardingPlan, InsertOnboardingStep, OnboardingPlan, OnboardingStep } from "@shared/schema";

interface OnboardingRequest {
  type: 'employee' | 'client' | 'contractor';
  role: string;
  department?: string;
  duration: number;
  tools?: string[];
  documents?: string[];
  culture?: string[];
  customRequirements?: string;
}

interface OnboardingPlanData {
  plan: {
    name: string;
    description: string;
    type: string;
    role: string;
    duration: number;
  };
  steps: Array<{
    title: string;
    description: string;
    category: 'welcome' | 'tools' | 'culture' | 'tasks' | 'goals' | 'feedback';
    dayNumber: number;
    order: number;
    assignedTo: 'ai' | 'manager' | 'buddy' | 'hr';
    isRequired: boolean;
    estimatedTime: number;
    resources: any[];
    completionCriteria: string;
  }>;
}

export class OnboardingAgent {
  private openai: OpenAI;

  constructor() {
    // No hard OPENAI_API_KEY requirement: getAiClient() resolves the provider
    // per user at call time (own Claude key or platform default), so own-key
    // users work even when the platform key is absent.
    this.openai = (getAiClient() as any);
  }

  async generateOnboardingPlan(request: OnboardingRequest, userId: string): Promise<OnboardingPlan> {
    try {
      // Create AI prompt for onboarding plan generation
      const prompt = this.createOnboardingPrompt(request);
      
      console.log("Making OpenAI API call for onboarding plan generation...");
      
      const onboardModel = await getModelForBudget(userId, "gpt-4o");
      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: onboardModel,
          messages: [
            {
              role: "system",
              content: `You are an AI onboarding specialist that creates comprehensive, personalized onboarding plans for new employees, clients, and contractors. 

Your goal is to create structured, day-by-day onboarding experiences that ensure smooth integration and early success.

Categories:
- welcome: Welcome messages, introductions, orientation
- tools: Software, logins, access setup
- culture: Company values, mission, team dynamics
- tasks: First assignments, learning objectives
- goals: 30-60-90 day objectives, milestones
- feedback: Check-ins, surveys, reviews

Assigned roles:
- ai: Automated tasks (emails, surveys, reminders)
- manager: Direct supervisor tasks
- buddy: Peer mentor tasks
- hr: HR department tasks

Return a structured JSON response with the plan details and daily steps.`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API call timeout')), 25000)
        )
      ]) as any;

      console.log("OpenAI API call completed successfully");

      if (completion.usage) {
        trackTokenUsage(userId, "onboarding-plan", onboardModel, completion.usage).catch(() => {});
      }

      const responseData = JSON.parse(completion.choices[0].message.content || '{}');

      // Long-term memory — record this onboarding-plan generation as a turn
      // for future cross-session retrieval. Fire-and-forget.
      void persistMemory({
        ctx: { userId, agentName: "onboarding-agent", retrieve: false },
        userQuery: prompt,
        agentResponse: completion.choices[0].message.content || "",
      });
      
      // Create the onboarding plan in database
      const planData: InsertOnboardingPlan = {
        name: responseData.plan.name,
        description: responseData.plan.description,
        type: request.type,
        role: request.role,
        duration: request.duration,
        status: 'draft',
        isTemplate: false,
        createdBy: userId
      };

      const plan = await storage.createOnboardingPlan(planData);

      // Create onboarding steps
      for (const stepData of responseData.steps) {
        const step: InsertOnboardingStep = {
          planId: plan.id,
          title: stepData.title,
          description: stepData.description,
          category: stepData.category,
          dayNumber: stepData.dayNumber,
          order: stepData.order,
          assignedTo: stepData.assignedTo,
          isRequired: stepData.isRequired,
          estimatedTime: stepData.estimatedTime,
          resources: stepData.resources,
          completionCriteria: stepData.completionCriteria
        };

        await storage.createOnboardingStep(step);
      }

      return plan;

    } catch (error) {
      console.error('Error generating onboarding plan:', error);
      throw new Error('Failed to generate onboarding plan');
    }
  }

  private createOnboardingPrompt(request: OnboardingRequest): string {
    return `Create a comprehensive ${request.duration}-day onboarding plan for a new ${request.type}.

Details:
- Type: ${request.type}
- Role: ${request.role}
- Department: ${request.department || 'Not specified'}
- Duration: ${request.duration} days
- Tools needed: ${request.tools?.join(', ') || 'Standard tools'}
- Documents: ${request.documents?.join(', ') || 'Standard documentation'}
- Culture elements: ${request.culture?.join(', ') || 'Company culture basics'}
- Custom requirements: ${request.customRequirements || 'None specified'}

Create a detailed daily breakdown with:
1. Welcome and orientation activities
2. Tool setup and access provisioning
3. Culture introduction and team integration
4. Initial tasks and learning objectives
5. Goal setting and milestone planning
6. Feedback loops and check-ins

Format the response as JSON with this structure:
{
  "plan": {
    "name": "Plan name",
    "description": "Brief description",
    "type": "${request.type}",
    "role": "${request.role}",
    "duration": ${request.duration}
  },
  "steps": [
    {
      "title": "Step title",
      "description": "Detailed description",
      "category": "welcome|tools|culture|tasks|goals|feedback",
      "dayNumber": 1,
      "order": 0,
      "assignedTo": "ai|manager|buddy|hr",
      "isRequired": true,
      "estimatedTime": 30,
      "resources": [],
      "completionCriteria": "What indicates completion"
    }
  ]
}

Make the plan comprehensive but practical, with clear objectives and realistic timeframes.`;
  }

  async generateWelcomeEmail(onboardeeName: string, role: string, startDate: string, managerName: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant that creates warm, professional welcome emails for new team members. Make the emails personalized, encouraging, and informative."
          },
          {
            role: "user",
            content: `Write a welcome email for ${onboardeeName} who is starting as a ${role} on ${startDate}. Their manager is ${managerName}. Include next steps and express excitement about them joining the team.`
          }
        ],
        temperature: 0.7,
      });

      if (completion.usage) {
        trackTokenUsage("system", "welcome-email", "gpt-4o", completion.usage).catch(() => {});
      }

      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating welcome email:', error);
      return `Welcome to the team, ${onboardeeName}! We're excited to have you join us as our new ${role}.`;
    }
  }

  async generateCompletionQuiz(topic: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<any> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI that creates interactive quizzes for onboarding. Create ${difficulty} level quizzes that test understanding of ${topic}.`
          },
          {
            role: "user",
            content: `Create a ${difficulty} quiz about ${topic} with 5 multiple choice questions. Format as JSON with questions, options, and correct answers.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      });

      if (completion.usage) {
        trackTokenUsage("system", "onboarding-quiz", "gpt-4o", completion.usage).catch(() => {});
      }

      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error generating quiz:', error);
      return null;
    }
  }

  async suggestImprovements(planId: number): Promise<string[]> {
    try {
      const plan = await storage.getOnboardingPlan(planId);
      const steps = await storage.getOnboardingSteps(planId);

      if (!plan) {
        throw new Error('Plan not found');
      }

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an onboarding expert that analyzes existing plans and suggests improvements for better new hire experience and engagement."
          },
          {
            role: "user",
            content: `Analyze this onboarding plan and suggest improvements:
            
Plan: ${plan.name} (${plan.type} - ${plan.role})
Duration: ${plan.duration} days
Steps: ${steps.length} total steps

Current steps:
${steps.map(s => `Day ${s.dayNumber}: ${s.title} (${s.category})`).join('\n')}

Provide 3-5 specific improvement suggestions as a JSON array of strings.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      });

      if (completion.usage) {
        trackTokenUsage("system", "onboarding-suggestions", "gpt-4o", completion.usage).catch(() => {});
      }

      const response = JSON.parse(completion.choices[0].message.content || '{}');
      return response.suggestions || [];
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return ['Consider adding more interactive elements', 'Include peer mentorship components'];
    }
  }

  async flagMissingElements(planId: number): Promise<string[]> {
    try {
      const steps = await storage.getOnboardingSteps(planId);
      const categories = steps.map(s => s.category);
      const missing = [];

      const requiredCategories = ['welcome', 'tools', 'culture', 'tasks', 'feedback'];
      
      for (const category of requiredCategories) {
        if (!categories.includes(category)) {
          missing.push(`Missing ${category} activities`);
        }
      }

      // Check for specific missing elements
      if (!steps.some(s => s.assignedTo === 'buddy')) {
        missing.push('No buddy/mentor assigned tasks');
      }

      if (!steps.some(s => s.category === 'goals')) {
        missing.push('No goal-setting activities');
      }

      if (steps.filter(s => s.category === 'feedback').length < 2) {
        missing.push('Insufficient feedback checkpoints');
      }

      return missing;
    } catch (error) {
      console.error('Error flagging missing elements:', error);
      return [];
    }
  }
}