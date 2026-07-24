import OpenAI from "openai";
import { getAiClient } from "./ai-provider";
import { storage } from "../database-storage";
import { trackTokenUsage } from "./token-tracker";
import { persistMemory } from "./agent-memory";
import {
  InsertUserStory,
  InsertStoryEstimation,
  UserStory,
} from "@shared/schema";

const openai = (getAiClient() as any);

interface StoryWriterInput {
  title: string;
  projectId: number;
  context?: string;
}

interface StoryWriterOutput {
  title: string;
  story: string;
  acceptanceCriteria: string[];
}

interface StoryEstimatorInput {
  story: UserStory;
  previousEstimates?: number[];
  teamVelocity?: number;
}

interface StoryEstimatorOutput {
  storyPoints: number;
  reasoning: string;
  factors: {
    complexity: number;
    risk: number;
    effort: number;
    uncertainty: number;
  };
}

interface BacklogGeneratorInput {
  feature: string;
  projectId: number;
  context?: string;
}

interface BacklogGeneratorOutput {
  stories: {
    title: string;
    story: string;
    acceptanceCriteria: string[];
    storyPoints: number;
    priority: string;
    dependencies?: string[];
  }[];
}

export class JiraAgentService {
  async writeUserStory(
    input: StoryWriterInput,
    /** Optional. When supplied, the call is logged to long-term memory. */
    userId?: string,
  ): Promise<StoryWriterOutput> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert Agile coach and story writer. Write clear, well-structured user stories following best practices.

            User Story Format:
            - Title: Concise and descriptive
            - Story: "As a [user], I want [feature] so that [benefit]"
            - Acceptance Criteria: Clear, testable conditions that must be met

            Focus on:
            - User value and business outcomes
            - Clear and testable acceptance criteria
            - Avoiding technical implementation details
            - Making stories small enough to complete in one sprint`,
          },
          {
            role: "user",
            content: `Write a user story for: "${input.title}"
            ${input.context ? `Context: ${input.context}` : ""}

            Return JSON with this format:
            {
              "title": "Clear story title",
              "story": "As a..., I want..., so that...",
              "acceptanceCriteria": ["Given..., When..., Then...", "Must have...", "Should support..."]
            }`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1000,
      });

      if (response.usage) {
        trackTokenUsage("system", "jira-agent-story", "gpt-4o", response.usage).catch(() => {});
      }

      const result = JSON.parse(response.choices[0].message.content || "{}");

      // Long-term memory log.
      void persistMemory({
        ctx: { userId, agentName: "jira-agent.writeUserStory", retrieve: false },
        userQuery: `Story: ${input.title}\n${(input as any).description || ""}`,
        agentResponse: response.choices[0].message.content || "",
      });

      return {
        title: result.title || input.title,
        story:
          result.story ||
          `As a user, I want ${input.title} so that I can improve my workflow`,
        acceptanceCriteria: result.acceptanceCriteria || [
          `Feature ${input.title} is implemented`,
          "User can access the feature",
          "Feature works as expected",
        ],
      };
    } catch (error) {
      console.error("Error writing user story:", error);
      return {
        title: input.title,
        story: `As a user, I want ${input.title} so that I can improve my workflow`,
        acceptanceCriteria: [
          `Feature ${input.title} is implemented`,
          "User can access the feature",
          "Feature works as expected",
        ],
      };
    }
  }

  async estimateStoryPoints(
    input: StoryEstimatorInput,
  ): Promise<StoryEstimatorOutput> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert Agile estimation specialist. Estimate story points using the Fibonacci sequence (1, 2, 3, 5, 8, 13, 21).

            Consider these factors:
            - Complexity: Technical difficulty and architecture impact
            - Risk: Unknowns, dependencies, third-party APIs
            - Effort: Amount of work required
            - Uncertainty: Clarity of requirements

            Story Point Guidelines:
            - 1-2: Simple, well-understood tasks
            - 3-5: Moderate complexity, some unknowns
            - 8-13: Complex features, significant unknowns
            - 21+: Should be broken down into smaller stories

            ${input.previousEstimates?.length ? `Team's recent estimates: ${input.previousEstimates.join(", ")} points` : ""}
            ${input.teamVelocity ? `Team velocity: ${input.teamVelocity} points/sprint` : ""}`,
          },
          {
            role: "user",
            content: `Estimate story points for:
            Title: ${input.story.title}
            Story: ${input.story.story}
            Acceptance Criteria: ${input.story.acceptanceCriteria?.join(", ")}

            Return JSON with:
            {
              "storyPoints": <fibonacci number>,
              "reasoning": "Clear explanation of the estimate",
              "factors": {
                "complexity": <1-5>,
                "risk": <1-5>,
                "effort": <1-5>,
                "uncertainty": <1-5>
              }
            }`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 800,
      });

      if (response.usage) {
        trackTokenUsage("system", "jira-agent-estimation", "gpt-4o", response.usage).catch(() => {});
      }

      const result = JSON.parse(response.choices[0].message.content || "{}");

      return {
        storyPoints: result.storyPoints || 5,
        reasoning:
          result.reasoning ||
          "Moderate complexity task with standard implementation",
        factors: result.factors || {
          complexity: 3,
          risk: 2,
          effort: 3,
          uncertainty: 2,
        },
      };
    } catch (error) {
      console.error("Error estimating story points:", error);
      return {
        storyPoints: 5,
        reasoning: "Default estimate due to AI service error",
        factors: {
          complexity: 3,
          risk: 2,
          effort: 3,
          uncertainty: 2,
        },
      };
    }
  }

  async generateBacklog(
    input: BacklogGeneratorInput,
  ): Promise<BacklogGeneratorOutput> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert Product Manager creating comprehensive backlogs. Generate a complete set of user stories for a feature or module.

            Guidelines:
            - Break down large features into manageable stories
            - Follow INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable)
            - Include both functional and non-functional requirements
            - Consider edge cases and error handling
            - Prioritize based on user value and dependencies
            - Each story should be completable in 1-2 sprints`,
          },
          {
            role: "user",
            content: `Generate a backlog for: "${input.feature}"
            ${input.context ? `Context: ${input.context}` : ""}

            Return JSON with an array of stories:
            {
              "stories": [
                {
                  "title": "Story title",
                  "story": "As a..., I want..., so that...",
                  "acceptanceCriteria": ["Given...", "When...", "Then..."],
                  "storyPoints": <fibonacci number>,
                  "priority": "high|medium|low|critical",
                  "dependencies": ["Other story titles if any"]
                }
              ]
            }`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 4000,
      });

      if (response.usage) {
        trackTokenUsage("system", "jira-agent-backlog", "gpt-4o", response.usage).catch(() => {});
      }

      const result = JSON.parse(response.choices[0].message.content || "{}");

      if (result.stories && Array.isArray(result.stories)) {
        return { stories: result.stories };
      }

      // Fallback if no stories generated
      return {
        stories: [
          {
            title: `Implement ${input.feature}`,
            story: `As a user, I want ${input.feature} so that I can enhance my productivity`,
            acceptanceCriteria: [
              `${input.feature} is fully implemented`,
              "Feature is accessible from the main menu",
              "Feature handles edge cases gracefully",
            ],
            storyPoints: 8,
            priority: "high",
            dependencies: [],
          },
        ],
      };
    } catch (error) {
      console.error("Error generating backlog:", error);
      return {
        stories: [
          {
            title: `Implement ${input.feature}`,
            story: `As a user, I want ${input.feature} so that I can enhance my productivity`,
            acceptanceCriteria: [
              `${input.feature} is fully implemented`,
              "Feature is accessible from the main menu",
              "Feature handles edge cases gracefully",
            ],
            storyPoints: 8,
            priority: "high",
            dependencies: [],
          },
        ],
      };
    }
  }

  async calculateRoiScore(story: UserStory): Promise<number> {
    // Simple ROI calculation based on priority, story points, and business value
    const priorityScores = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };

    const baseScore =
      priorityScores[story.priority as keyof typeof priorityScores] || 50;
    const effortFactor = story.storyPoints ? 21 / story.storyPoints : 1; // Inverse relationship with effort

    return Math.round(baseScore * effortFactor);
  }

  async prioritizeBacklog(stories: UserStory[]): Promise<UserStory[]> {
    // Calculate ROI scores for all stories
    const storiesWithScores = await Promise.all(
      stories.map(async (story) => ({
        ...story,
        roiScore: await this.calculateRoiScore(story),
      })),
    );

    // Sort by ROI score (highest first), then by priority
    return storiesWithScores.sort((a, b) => {
      if (b.roiScore !== a.roiScore) {
        return b.roiScore - a.roiScore;
      }

      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const aPriority =
        priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
      const bPriority =
        priorityOrder[b.priority as keyof typeof priorityOrder] || 2;

      return aPriority - bPriority;
    });
  }
}

export const jiraAgent = new JiraAgentService();
