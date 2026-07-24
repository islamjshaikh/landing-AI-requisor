import OpenAI from "openai";
import { getAiClient } from "./ai-provider";
import { storage } from "../storage";
import { trackTokenUsage } from "./token-tracker";
import {
  InsertUserStory,
  InsertStoryEstimation,
  UserStory,
  JiraIntegration,
  InsertJiraIntegration,
} from "@shared/schema";

const openai = (getAiClient() as any);

export interface StoryWriterInput {
  title: string;
  projectId: number;
  context?: string;
  targetUser?: string;
  businessValue?: string;
}

export interface StoryWriterOutput {
  title: string;
  story: string;
  acceptanceCriteria: string[];
  storyPoints?: number;
  priority?: string;
  complexity?: string;
  risk?: string;
  effort?: string;
}

export interface StoryEstimatorInput {
  story: UserStory;
  previousEstimates?: number[];
  teamVelocity?: number;
}

export interface StoryEstimatorOutput {
  storyPoints: number;
  reasoning: string;
  confidence: number;
  factors: {
    complexity: number;
    risk: number;
    effort: number;
    uncertainty: number;
  };
}

export interface BacklogGeneratorInput {
  feature: string;
  projectId: number;
  context?: string;
  targetSprint?: string;
  estimatedTeamSize?: number;
}

export interface BacklogGeneratorOutput {
  stories: {
    title: string;
    story: string;
    acceptanceCriteria: string[];
    storyPoints: number;
    priority: string;
    dependencies?: string[];
    tags?: string[];
  }[];
  summary: {
    totalStories: number;
    totalPoints: number;
    estimatedSprints: number;
    priorityBreakdown: Record<string, number>;
  };
}

export interface JiraConnectionTest {
  isValid: boolean;
  message: string;
  availableProjects?: Array<{
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
  }>;
}

export class JiraService {
  /**
   * Write a user story from a feature idea using AI
   */
  async writeUserStory(input: StoryWriterInput): Promise<StoryWriterOutput> {
    try {
      const contextString = [
        input.context,
        input.targetUser ? `Target User: ${input.targetUser}` : "",
        input.businessValue ? `Business Value: ${input.businessValue}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert Agile coach and story writer with 15+ years of experience. Write clear, well-structured user stories following industry best practices.

            User Story Format:
            - Title: Concise and descriptive (max 50 characters)
            - Story: "As a [specific user type], I want [specific capability] so that [clear benefit/value]"
            - Acceptance Criteria: Clear, testable conditions using Given/When/Then format when applicable

            Focus on:
            - User value and business outcomes
            - Clear and testable acceptance criteria
            - Avoiding technical implementation details
            - Making stories small enough to complete in one sprint (1-2 weeks)
            - Following INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable)

            Story Point Estimation Guidelines:
            - 1-2: Simple, well-understood tasks
            - 3-5: Moderate complexity, some unknowns
            - 8-13: Complex features, significant unknowns
            - 21+: Should be broken down into smaller stories

            Priority Levels:
            - Critical: Blocking other work or core functionality
            - High: Important for release, significant user impact
            - Medium: Valuable but not urgent
            - Low: Nice to have, minimal impact

            Complexity Levels:
            - Low: Simple CRUD operations, basic UI changes
            - Medium: Complex business logic, integrations
            - High: New architecture, complex algorithms

            Risk Levels:
            - Low: Well-understood technology, clear requirements
            - Medium: Some unknowns, moderate dependencies
            - High: New technology, unclear requirements, many dependencies`,
          },
          {
            role: "user",
            content: `Write a comprehensive user story for: "${input.title}"

            ${contextString ? `Additional Context:\n${contextString}` : ""}

            Return JSON with this exact format:
            {
              "title": "Clear story title (max 50 chars)",
              "story": "As a [specific user], I want [specific capability] so that [clear benefit]",
              "acceptanceCriteria": ["Given..., When..., Then...", "Must have...", "Should support..."],
              "storyPoints": <fibonacci number 1-21>,
              "priority": "critical|high|medium|low",
              "complexity": "low|medium|high",
              "risk": "low|medium|high",
              "effort": "low|medium|high"
            }`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500,
      });

      if (response.usage) {
        trackTokenUsage("system", "jira-story-writer", "gpt-4o", response.usage).catch(() => {});
      }

      const result = JSON.parse(response.choices[0].message.content || "{}");

      // Validate and clean the result
      return {
        title: result.title || input.title,
        story:
          result.story ||
          `As a user, I want ${input.title} so that I can improve my workflow`,
        acceptanceCriteria: Array.isArray(result.acceptanceCriteria)
          ? result.acceptanceCriteria
          : [
              `Feature ${input.title} is implemented`,
              "User can access the feature",
              "Feature works as expected",
            ],
        storyPoints: result.storyPoints || 5,
        priority: result.priority || "medium",
        complexity: result.complexity || "medium",
        risk: result.risk || "medium",
        effort: result.effort || "medium",
      };
    } catch (error) {
      console.error("Error writing user story:", error);
      // Return fallback story
      return {
        title: input.title,
        story: `As a user, I want ${input.title} so that I can improve my workflow`,
        acceptanceCriteria: [
          `Feature ${input.title} is implemented`,
          "User can access the feature",
          "Feature works as expected",
        ],
        storyPoints: 5,
        priority: "medium",
        complexity: "medium",
        risk: "medium",
        effort: "medium",
      };
    }
  }

  /**
   * Estimate story points for a user story using AI
   */
  async estimateStoryPoints(
    input: StoryEstimatorInput,
  ): Promise<StoryEstimatorOutput> {
    try {
      const previousEstimatesContext = input.previousEstimates?.length
        ? `Team's recent estimates: ${input.previousEstimates.join(", ")} points`
        : "";

      const velocityContext = input.teamVelocity
        ? `Team velocity: ${input.teamVelocity} points/sprint`
        : "";

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert Agile estimation specialist with deep experience in story point estimation. Use the Fibonacci sequence (1, 2, 3, 5, 8, 13, 21) for estimates.

            Consider these factors for estimation:
            - Complexity: Technical difficulty, architecture impact, number of components affected
            - Risk: Unknowns, dependencies, third-party APIs, new technology
            - Effort: Amount of work required, development time, testing needs
            - Uncertainty: Clarity of requirements, definition of done, acceptance criteria completeness

            Story Point Guidelines:
            - 1: Trivial change, well-understood, no dependencies
            - 2: Simple feature, minor complexity, clear requirements
            - 3: Standard feature, moderate complexity, some unknowns
            - 5: Complex feature, significant work, some dependencies
            - 8: Very complex, multiple unknowns, significant dependencies
            - 13: Epic-level work, high complexity, many unknowns
            - 21: Should be broken down into smaller stories

            Confidence Levels:
            - 90-100%: Very clear requirements, familiar technology
            - 70-89%: Clear requirements, some unknowns
            - 50-69%: Moderate clarity, several unknowns
            - 30-49%: Unclear requirements, many unknowns
            - 10-29%: Very unclear, needs more information

            ${previousEstimatesContext}
            ${velocityContext}`,
          },
          {
            role: "user",
            content: `Estimate story points for this user story:

            Title: ${input.story.title}
            Story: ${input.story.story}
            Acceptance Criteria: ${input.story.acceptanceCriteria?.join(", ") || "None specified"}
            Current Priority: ${input.story.priority || "Not specified"}
            Current Complexity: ${input.story.complexity || "Not specified"}
            Current Risk: ${input.story.risk || "Not specified"}

            Return JSON with:
            {
              "storyPoints": <fibonacci number 1-21>,
              "reasoning": "Detailed explanation of the estimate including key factors considered",
              "confidence": <percentage 10-100>,
              "factors": {
                "complexity": <1-5 scale>,
                "risk": <1-5 scale>,
                "effort": <1-5 scale>,
                "uncertainty": <1-5 scale>
              }
            }`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 1000,
      });

      if (response.usage) {
        trackTokenUsage("system", "jira-story-estimation", "gpt-4o", response.usage).catch(() => {});
      }

      const result = JSON.parse(response.choices[0].message.content || "{}");

      return {
        storyPoints: result.storyPoints || 5,
        reasoning:
          result.reasoning ||
          "Moderate complexity task with standard implementation",
        confidence: result.confidence || 70,
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
        confidence: 50,
        factors: {
          complexity: 3,
          risk: 2,
          effort: 3,
          uncertainty: 2,
        },
      };
    }
  }

  /**
   * Generate a complete backlog for a feature using AI
   */
  async generateBacklog(
    input: BacklogGeneratorInput,
  ): Promise<BacklogGeneratorOutput> {
    try {
      const contextString = [
        input.context,
        input.targetSprint ? `Target Sprint: ${input.targetSprint}` : "",
        input.estimatedTeamSize
          ? `Team Size: ${input.estimatedTeamSize} developers`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert Product Manager with 15+ years of experience creating comprehensive product backlogs. Generate a complete set of user stories for a feature or module.

            Guidelines:
            - Break down large features into manageable stories (1-2 sprints each)
            - Follow INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable)
            - Include both functional and non-functional requirements
            - Consider edge cases, error handling, and user experience
            - Prioritize based on user value, dependencies, and risk
            - Include setup, implementation, testing, and documentation stories
            - Consider different user types and their needs
            - Include accessibility and performance considerations

            Story Prioritization:
            - Critical: Core functionality, blocking dependencies
            - High: Major user value, important for MVP
            - Medium: Nice to have, enhances user experience
            - Low: Future enhancements, minimal impact

            Story Point Distribution:
            - Aim for stories between 1-8 points
            - Break down any story over 8 points
            - Most stories should be 3-5 points
            - Include some small 1-2 point stories for quick wins`,
          },
          {
            role: "user",
            content: `Generate a comprehensive backlog for: "${input.feature}"

            ${contextString ? `Additional Context:\n${contextString}` : ""}

            Return JSON with this exact format:
            {
              "stories": [
                {
                  "title": "Clear story title",
                  "story": "As a [specific user], I want [specific capability] so that [clear benefit]",
                  "acceptanceCriteria": ["Given...", "When...", "Then..."],
                  "storyPoints": <fibonacci number 1-21>,
                  "priority": "critical|high|medium|low",
                  "dependencies": ["Other story titles if any"],
                  "tags": ["relevant", "tags"]
                }
              ],
              "summary": {
                "totalStories": <number>,
                "totalPoints": <number>,
                "estimatedSprints": <number>,
                "priorityBreakdown": {
                  "critical": <number>,
                  "high": <number>,
                  "medium": <number>,
                  "low": <number>
                }
              }
            }`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 4000,
      });

      if (response.usage) {
        trackTokenUsage("system", "jira-backlog-generation", "gpt-4o", response.usage).catch(() => {});
      }

      const result = JSON.parse(response.choices[0].message.content || "{}");

      if (result.stories && Array.isArray(result.stories)) {
        // Calculate summary if not provided
        const totalStories = result.stories.length;
        const totalPoints = result.stories.reduce(
          (sum: number, story: any) => sum + (story.storyPoints || 0),
          0,
        );
        const priorityBreakdown = result.stories.reduce(
          (acc: any, story: any) => {
            acc[story.priority] = (acc[story.priority] || 0) + 1;
            return acc;
          },
          {},
        );

        return {
          stories: result.stories,
          summary: result.summary || {
            totalStories,
            totalPoints,
            estimatedSprints: Math.ceil(totalPoints / 25), // Assuming 25 points per sprint
            priorityBreakdown,
          },
        };
      }

      // Fallback if no stories generated
      return {
        stories: [
          {
            title: `Implement ${input.feature}`,
            story: `As a user, I want ${input.feature} so that I can enhance my productivity`,
            acceptanceCriteria: [
              `${input.feature} is fully implemented`,
              "User can access the feature",
              "Feature works as expected",
            ],
            storyPoints: 5,
            priority: "high",
            tags: ["feature", "implementation"],
          },
        ],
        summary: {
          totalStories: 1,
          totalPoints: 5,
          estimatedSprints: 1,
          priorityBreakdown: { high: 1, medium: 0, low: 0, critical: 0 },
        },
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
              "User can access the feature",
              "Feature works as expected",
            ],
            storyPoints: 5,
            priority: "high",
            tags: ["feature", "implementation"],
          },
        ],
        summary: {
          totalStories: 1,
          totalPoints: 5,
          estimatedSprints: 1,
          priorityBreakdown: { high: 1, medium: 0, low: 0, critical: 0 },
        },
      };
    }
  }

  /**
   * Test JIRA connection and return available projects
   */
  async testJiraConnection(
    integration: Partial<JiraIntegration>,
  ): Promise<JiraConnectionTest> {
    try {
      if (!integration.jiraUrl || !integration.email || !integration.apiToken) {
        return {
          isValid: false,
          message: "Missing required JIRA credentials",
        };
      }

      // Create basic auth header
      const auth = Buffer.from(
        `${integration.email}:${integration.apiToken}`,
      ).toString("base64");

      // Normalize JIRA URL - remove trailing slash
      const normalizedUrl = integration.jiraUrl.replace(/\/$/, "");

      console.log("JIRA API Response - Testing connection to:", normalizedUrl);

      // Test connection by fetching projects
      const response = await fetch(`${normalizedUrl}/rest/api/3/project`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          isValid: false,
          message: `JIRA connection failed: ${response.status} ${response.statusText}. ${errorText}`,
        };
      }

      const projects = await response.json();

      console.log(
        "JIRA API Response - Raw projects:",
        JSON.stringify(projects),
      );
      console.log(
        "JIRA API Response - Number of projects:",
        Array.isArray(projects) ? projects.length : "Not an array",
      );

      // Check if projects is actually an array and has content
      if (!Array.isArray(projects)) {
        console.error("JIRA API returned non-array response:", projects);
        return {
          isValid: false,
          message: "JIRA API returned unexpected response format",
        };
      }

      return {
        isValid: true,
        message: "JIRA connection successful",
        availableProjects: projects.map((project: any) => ({
          id: project.id,
          key: project.key,
          name: project.name,
          projectTypeKey: project.projectTypeKey,
        })),
      };
    } catch (error) {
      console.error("Error testing JIRA connection:", error);
      return {
        isValid: false,
        message: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Create a JIRA issue from a user story
   */
  async createJiraIssue(
    integration: JiraIntegration,
    story: UserStory,
    projectKey: string,
  ): Promise<any> {
    try {
      const auth = Buffer.from(
        `${integration.email}:${integration.apiToken}`,
      ).toString("base64");

      const issueData = {
        fields: {
          project: {
            key: projectKey,
          },
          summary: story.title,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: story.story,
                  },
                ],
              },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "\n\nAcceptance Criteria:",
                  },
                ],
              },
              ...(story.acceptanceCriteria?.map((criteria) => ({
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: `• ${criteria}`,
                  },
                ],
              })) || []),
            ],
          },
          issuetype: {
            name: "Story",
          },
        },
      };

      // Add story points if available
      if (story.storyPoints) {
        issueData.fields["customfield_10002"] = story.storyPoints; // Common story points field
      }

      const response = await fetch(`${integration.jiraUrl}/rest/api/3/issue`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(issueData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create JIRA issue: ${response.status} ${response.statusText}. ${errorText}`,
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error creating JIRA issue:", error);
      throw error;
    }
  }

  /**
   * Calculate ROI score for a user story
   */
  async calculateRoiScore(story: UserStory): Promise<number> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert business analyst specializing in ROI calculation for software features. Calculate ROI based on business value, implementation effort, and strategic alignment.

            ROI Scoring Factors:
            - Business Value (40%): User impact, revenue potential, competitive advantage
            - Implementation Effort (30%): Development complexity, time to market, resource requirements
            - Strategic Alignment (20%): Company goals, market positioning, future scalability
            - Risk Mitigation (10%): Reduces technical debt, improves security, prevents issues

            ROI Score Scale:
            - 90-100: High business value, low effort, critical for success
            - 70-89: Strong business value, moderate effort, important for growth
            - 50-69: Moderate value, standard effort, good for improvement
            - 30-49: Low value, high effort, questionable priority
            - 10-29: Minimal value, very high effort, likely to deprioritize`,
          },
          {
            role: "user",
            content: `Calculate ROI score for this user story:

            Title: ${story.title}
            Story: ${story.story}
            Priority: ${story.priority}
            Story Points: ${story.storyPoints || "Not estimated"}
            Complexity: ${story.complexity || "Not specified"}
            Risk: ${story.risk || "Not specified"}

            Return only a number between 10-100 representing the ROI score.`,
          },
        ],
        temperature: 0.5,
        max_tokens: 50,
      });

      if (response.usage) {
        trackTokenUsage("system", "jira-roi-score", "gpt-4o", response.usage).catch(() => {});
      }

      const scoreText = response.choices[0].message.content?.trim() || "50";
      const score = parseInt(scoreText.replace(/[^0-9]/g, ""));

      return Math.max(10, Math.min(100, score || 50));
    } catch (error) {
      console.error("Error calculating ROI score:", error);
      // Fallback calculation based on priority and complexity
      const priorityWeight = { critical: 90, high: 70, medium: 50, low: 30 };
      const complexityWeight = { low: 10, medium: 0, high: -10 };

      return Math.max(
        10,
        Math.min(
          100,
          (priorityWeight[story.priority as keyof typeof priorityWeight] ||
            50) +
            (complexityWeight[
              story.complexity as keyof typeof complexityWeight
            ] || 0),
        ),
      );
    }
  }

  /**
   * Save user story to database
   */
  async saveUserStory(storyData: InsertUserStory): Promise<UserStory> {
    try {
      const story = await storage.createUserStory(storyData);
      return story;
    } catch (error) {
      console.error("Error saving user story:", error);
      throw error;
    }
  }

  /**
   * Get user stories for a project
   */
  async getUserStoriesForProject(projectId: number): Promise<UserStory[]> {
    try {
      const stories = await storage.getUserStoriesForProject(projectId);
      return stories;
    } catch (error) {
      console.error("Error fetching user stories:", error);
      throw error;
    }
  }

  /**
   * Save or update JIRA integration
   */
  async saveJiraIntegration(
    userId: string,
    integrationData: Partial<InsertJiraIntegration>,
  ): Promise<JiraIntegration> {
    try {
      // Check if integration already exists for this user
      const existingIntegration = await storage.getJiraIntegration(userId);

      if (existingIntegration) {
        // Update existing integration
        const updated = await storage.updateJiraIntegration(
          existingIntegration.id,
          integrationData,
        );
        return updated;
      } else {
        // Create new integration
        const integration = await storage.createJiraIntegration({
          userId,
          ...integrationData,
        } as InsertJiraIntegration);
        return integration;
      }
    } catch (error) {
      console.error("Error saving JIRA integration:", error);
      throw error;
    }
  }

  /**
   * Get JIRA integration for user
   */
  async getJiraIntegration(userId: string): Promise<JiraIntegration | null> {
    try {
      const integration = await storage.getJiraIntegration(userId);
      return integration || null;
    } catch (error) {
      console.error("Error fetching JIRA integration:", error);
      return null;
    }
  }
}

export const jiraService = new JiraService();
