import OpenAI from "openai";
import { getAiClient } from "./ai-provider";
import { v4 as uuidv4 } from "uuid";
import { trackTokenUsage } from "./token-tracker";

const openai = (getAiClient() as any);

interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints?: number;
  priority: "high" | "medium" | "low";
  epicId: string;
}

interface Epic {
  id: string;
  name: string;
  description: string;
  stories: UserStory[];
}

interface Initiative {
  id: string;
  name: string;
  description: string;
  epics: Epic[];
}

interface AgilePlan {
  initiative: Initiative;
  createdAt: Date;
}

export class AgilePlanningService {
  async generateAgilePlan(
    prompt: string,
    currentPlan?: any,
    isRegeneration?: boolean,
  ): Promise<AgilePlan> {
    try {
      // If this is a regeneration request, modify the system prompt and include the current plan
      let systemPrompt = `You are an elite Agile coach and product strategist with 20+ years of experience helping companies transform ideas into successful products. Your expertise spans user experience design, technical architecture, and business strategy.

CRITICAL: You must analyze the user's specific request deeply and create a highly contextual, detailed agile plan that directly addresses their unique needs. DO NOT generate generic content.

Your task is to create an exceptional agile plan that:
1. Deeply understands the user's specific domain, industry, and unique requirements
2. Provides innovative, specific solutions tailored to their exact needs
3. Includes realistic technical details and implementation strategies
4. Considers user personas, market positioning, and business value

Return a JSON object with this EXACT structure:
{
  "initiative": {
    "name": "Specific, compelling initiative name that reflects the user's vision",
    "description": "Detailed description explaining the strategic value and business impact",
    "epics": [
      {
        "name": "Epic name that represents a major feature area",
        "description": "Comprehensive description of what this epic achieves and why it matters",
        "stories": [
          {
            "title": "Specific, actionable user story title",
            "description": "As a [specific user type], I want [detailed goal] so that [clear business value]",
            "acceptanceCriteria": [
              "Specific, measurable criterion that can be tested",
              "Technical requirement with clear success metric",
              "User experience requirement with defined outcome",
              "Performance or quality criterion with threshold"
            ],
            "storyPoints": 3,
            "priority": "high" | "medium" | "low"
          }
        ]
      }
    ]
  }
}

REQUIREMENTS:
1. Create 3-5 highly relevant epics that comprehensively cover the user's needs
2. Generate 4-6 detailed user stories per epic
3. Each story MUST be specific to the user's domain - NO generic stories
4. Stories must follow: "As a [specific persona], I want [detailed feature] so that [clear value]"
5. Include 3-5 detailed, testable acceptance criteria per story
6. Use Fibonacci sequence for story points: 1, 2, 3, 5, 8, 13
7. Prioritize based on business value, technical dependencies, and user impact
8. Consider technical implementation details, integrations, and edge cases
9. Include modern best practices for the specific technology stack mentioned
10. Address security, scalability, and user experience in your stories

CONTEXT ANALYSIS:
Before creating the plan, identify:
- The specific industry/domain
- Target users and their pain points
- Technical requirements and constraints
- Business goals and success metrics
- Unique challenges that need addressing

Remember: Every story must be directly relevant to the user's specific request. Generic content is unacceptable.`;

      // Handle regeneration requests differently
      let userMessage = `Create a comprehensive, detailed agile plan for the following specific request. Analyze the domain deeply and provide highly contextual, non-generic content:\n\n${prompt}`;

      if (isRegeneration && currentPlan) {
        console.log("REGENERATION REQUEST DETECTED");
        console.log("Current plan:", currentPlan.initiative.name);
        console.log("User feedback:", prompt);

        systemPrompt =
          systemPrompt +
          `\n\nIMPORTANT: The user has an existing plan that they want you to IMPROVE/REGENERATE based on their feedback. You must:
1. Keep the same project domain and core concept
2. Enhance and refine based on their specific feedback
3. Make the requested improvements while maintaining the project's essence
4. DO NOT create a completely different project - refine the existing one`;

        userMessage = `The user has the following existing agile plan:

Initiative: ${currentPlan.initiative.name}
Description: ${currentPlan.initiative.description}
Epics: ${currentPlan.initiative.epics.map((e: any) => e.name).join(", ")}

User's feedback/request for regeneration: ${prompt}

Please REGENERATE and IMPROVE this existing plan based on the user's feedback. Keep the same project concept but enhance it according to their request.`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      if (response.usage) {
        trackTokenUsage("system", "agile-planning", "gpt-4o", response.usage).catch(() => {});
      }

      const planData = JSON.parse(response.choices[0].message.content || "{}");

      console.log("OpenAI response parsed:", JSON.stringify(planData, null, 2));

      // Validate the response structure
      if (
        !planData.initiative ||
        !planData.initiative.epics ||
        !Array.isArray(planData.initiative.epics)
      ) {
        console.error("Invalid plan structure from OpenAI:", planData);
        throw new Error("Generated plan has invalid structure");
      }

      // Add IDs to all entities
      const initiative: Initiative = {
        id: uuidv4(),
        name: planData.initiative.name || "Untitled Initiative",
        description:
          planData.initiative.description || "No description provided",
        epics: planData.initiative.epics.map((epic: any) => ({
          id: uuidv4(),
          name: epic.name || "Untitled Epic",
          description: epic.description || "No description",
          stories: (epic.stories || []).map((story: any) => ({
            id: uuidv4(),
            title: story.title || "Untitled Story",
            description: story.description || "No description",
            acceptanceCriteria: story.acceptanceCriteria || [],
            storyPoints: story.storyPoints || 3,
            priority: story.priority || "medium",
            epicId: "", // Will be set after epic is created
          })),
        })),
      };

      // Set epic IDs on stories
      initiative.epics.forEach((epic) => {
        epic.stories.forEach((story) => {
          story.epicId = epic.id;
        });
      });

      return {
        initiative,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error("Error generating agile plan:", error);

      // If OpenAI fails, generate a simple fallback plan structure
      const fallbackInitiative: Initiative = {
        id: uuidv4(),
        name: `Project Plan for: ${prompt.substring(0, 50)}...`,
        description: "AI-generated agile plan",
        epics: [
          {
            id: uuidv4(),
            name: "Phase 1: Foundation",
            description: "Initial setup and core functionality",
            stories: [
              {
                id: uuidv4(),
                title: "Set up project infrastructure",
                description:
                  "As a developer, I want to set up the basic project structure so that we can begin development",
                acceptanceCriteria: [
                  "Project repository created",
                  "Development environment configured",
                  "CI/CD pipeline established",
                ],
                storyPoints: 5,
                priority: "high" as const,
                epicId: "",
              },
              {
                id: uuidv4(),
                title: "Implement core functionality",
                description:
                  "As a user, I want the basic features to work so that I can use the application",
                acceptanceCriteria: [
                  "Core features implemented",
                  "Basic UI completed",
                  "Initial testing done",
                ],
                storyPoints: 8,
                priority: "high" as const,
                epicId: "",
              },
            ],
          },
          {
            id: uuidv4(),
            name: "Phase 2: Enhancement",
            description: "Additional features and improvements",
            stories: [
              {
                id: uuidv4(),
                title: "Add advanced features",
                description:
                  "As a user, I want additional features so that I can do more with the application",
                acceptanceCriteria: [
                  "Advanced features designed",
                  "Features implemented",
                  "User testing completed",
                ],
                storyPoints: 13,
                priority: "medium" as const,
                epicId: "",
              },
            ],
          },
        ],
      };

      // Set epic IDs on stories
      fallbackInitiative.epics.forEach((epic) => {
        epic.stories.forEach((story) => {
          story.epicId = epic.id;
        });
      });

      console.log("Using fallback plan due to error");

      return {
        initiative: fallbackInitiative,
        createdAt: new Date(),
      };
    }
  }

  async exportToJira(plan: AgilePlan): Promise<any> {
    // Format the plan for Jira import
    const jiraExport = {
      epics: plan.initiative.epics.map((epic) => ({
        summary: epic.name,
        description: epic.description,
        issueType: "Epic",
        stories: epic.stories.map((story) => ({
          summary: story.title,
          description: `${story.description}\n\nAcceptance Criteria:\n${story.acceptanceCriteria.map((ac) => `- ${ac}`).join("\n")}`,
          issueType: "Story",
          storyPoints: story.storyPoints,
          priority: this.mapPriorityToJira(story.priority),
          epicLink: epic.name,
        })),
      })),
    };

    return jiraExport;
  }

  private mapPriorityToJira(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      high: "Highest",
      medium: "Medium",
      low: "Low",
    };
    return priorityMap[priority] || "Medium";
  }
}

export const agilePlanningService = new AgilePlanningService();
