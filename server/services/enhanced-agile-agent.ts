import OpenAI from "openai";
import { getAiClient } from "./ai-provider";
import { trackTokenUsage } from "./token-tracker";
import { persistMemory } from "./agent-memory";

interface ProjectCanvas {
  initiative: {
    id: string;
    name: string;
    description: string;
    epics: Epic[];
  };
}

interface Epic {
  id: string;
  name: string;
  description: string;
  stories: Story[];
}

interface Story {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: "high" | "medium" | "low";
  storyPoints?: number;
  status?: string;
  dueDate?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

interface AgentAction {
  action:
    | "add_story"
    | "update_story"
    | "delete_story"
    | "add_epic"
    | "update_epic"
    | "delete_epic"
    | "regenerate_section"
    | "analyze"
    | "create_plan";
  target?: string;
  data?: any;
  explanation?: string;
}

export class EnhancedAgileAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = (getAiClient() as any);
  }

  // Intent Recognition System
  analyzeIntent(userMessage: string): {
    intent: string;
    confidence: number;
    targets: string[];
  } {
    const message = userMessage.toLowerCase();

    // Intent patterns with keywords - ORDER MATTERS for priority
    const patterns = {
      // Refinement patterns (higher priority than create_plan)
      regenerate_section: [
        "regenerate",
        "redo",
        "recreate",
        "start over",
        "generate again",
        "generate the plan again",
        "not detailed enough",
        "improve the",
        "make it more detailed",
        "better acceptance",
        "more specific",
      ],
      analyze: [
        "analyze",
        "review",
        "feedback",
        "suggestions",
        "improve",
        "refine",
        "enhance",
        "detailed enough",
        "criteria",
      ],
      // Story/Epic management
      add_story: ["add story", "create story", "new story", "add user story"],
      update_story: [
        "update story",
        "edit story",
        "change story",
        "modify story",
      ],
      delete_story: ["delete story", "remove story", "drop story"],
      add_epic: ["add epic", "create epic", "new epic"],
      update_epic: ["update epic", "edit epic", "change epic"],
      delete_epic: ["delete epic", "remove epic"],
      // Plan creation (only for truly new plans)
      create_plan: [
        "create new plan",
        "build new plan",
        "start fresh plan",
        "completely new project",
      ],
    };

    let bestMatch = { intent: "analyze", confidence: 0.3, targets: [] };

    for (const [intent, keywords] of Object.entries(patterns)) {
      const matches = keywords.filter((keyword) => message.includes(keyword));
      if (matches.length > 0) {
        const confidence = matches.length / keywords.length;
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            intent,
            confidence,
            targets: this.extractTargets(message),
          };
        }
      }
    }

    console.log("Intent analysis:", {
      message,
      detectedIntent: bestMatch.intent,
      confidence: bestMatch.confidence,
      targets: bestMatch.targets,
    });

    return bestMatch;
  }

  private extractTargets(message: string): string[] {
    // Extract quoted strings or specific mentions
    const quoted = message.match(/"([^"]+)"/g) || [];
    const targets = quoted.map((q) => q.replace(/"/g, ""));

    // Look for epic/story references
    const epicMatches = message.match(/epic[:\s]+([^\n,\.]+)/gi) || [];
    const storyMatches = message.match(/story[:\s]+([^\n,\.]+)/gi) || [];

    return [...targets, ...epicMatches, ...storyMatches].map((t) => t.trim());
  }

  // Context-Aware Processing
  async processUserRequest(
    userMessage: string,
    currentCanvas: ProjectCanvas | null,
    chatHistory: ChatMessage[],
    actionHistory: string[],
    /** Optional. When supplied, the call is logged to long-term memory. */
    userId?: string,
  ): Promise<AgentAction> {
    const intent = this.analyzeIntent(userMessage);

    // Build context for GPT
    const context = this.buildContext(
      currentCanvas,
      chatHistory,
      actionHistory,
    );

    const systemPrompt = `You are an expert Agile Planning AI assistant. You understand project management, user stories, epics, and agile methodologies.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid JSON object - no explanations, no markdown, no additional text
2. Analyze the user's request and current project context to determine the appropriate action
3. For modifications, return only the specific changes needed (not the full canvas)
4. Be precise and surgical in your updates
5. IMPORTANT: If there is existing project content, NEVER create a new plan - only refine, improve, or modify the existing one

REFINEMENT PRIORITY:
- If user asks to "generate again", "improve", "make more detailed", etc. AND there's existing content → use "regenerate_section" or "analyze"
- If user asks for "new plan" with NO existing content → use "create_plan"
- If user mentions specific acceptance criteria issues → use "update_story" to improve those specific stories

Available actions: add_story, update_story, delete_story, add_epic, update_epic, delete_epic, regenerate_section, analyze, create_plan

Response format must be exactly:
{
  "action": "action_type",
  "target": "target_id_or_name",
  "data": { relevant_data },
  "explanation": "brief explanation of what you're doing"
}

Current project context:
${context}

Detected intent: ${intent.intent} (confidence: ${intent.confidence})
Targets: ${intent.targets.join(", ")}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      if (response.usage) {
        trackTokenUsage("system", "enhanced-agile-agent", "gpt-4o", response.usage).catch(() => {});
      }

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      // Parse JSON response
      const action: AgentAction = JSON.parse(content);

      // Long-term memory log.
      void persistMemory({
        ctx: { userId, agentName: "enhanced-agile-agent", retrieve: false },
        userQuery: userMessage,
        agentResponse: content,
        actions: action,
      });

      return action;
    } catch (error) {
      console.error("Enhanced Agile Agent error:", error);

      // Fallback based on intent analysis
      return this.generateFallbackAction(intent, userMessage, currentCanvas);
    }
  }

  private buildContext(
    canvas: ProjectCanvas | null,
    chatHistory: ChatMessage[],
    actionHistory: string[],
  ): string {
    let context = "";

    if (canvas) {
      context += `CURRENT PROJECT CANVAS:\n`;
      context += `Initiative: ${canvas.initiative.name}\n`;
      context += `Description: ${canvas.initiative.description}\n`;
      context += `Epics: ${canvas.initiative.epics.length}\n`;

      canvas.initiative.epics.forEach((epic, i) => {
        context += `  Epic ${i + 1}: ${epic.name} (${epic.stories.length} stories)\n`;
        epic.stories.forEach((story, j) => {
          context += `    Story ${j + 1}: ${story.title} [${story.priority}] ${story.storyPoints || 0}pts\n`;
        });
      });
    } else {
      context += `CURRENT PROJECT CANVAS: Empty - no plan generated yet\n`;
    }

    // Recent chat history (last 3 messages)
    const recentChat = chatHistory.slice(-3);
    if (recentChat.length > 0) {
      context += `\nRECENT CONVERSATION:\n`;
      recentChat.forEach((msg) => {
        context += `${msg.role}: ${msg.content}\n`;
      });
    }

    // Action history
    if (actionHistory.length > 0) {
      context += `\nRECENT ACTIONS:\n`;
      actionHistory.slice(-5).forEach((action) => {
        context += `- ${action}\n`;
      });
    }

    return context;
  }

  private generateFallbackAction(
    intent: { intent: string; confidence: number; targets: string[] },
    userMessage: string,
    canvas: ProjectCanvas | null,
  ): AgentAction {
    switch (intent.intent) {
      case "regenerate_section":
        // If there's existing content, improve it rather than create new
        if (canvas && canvas.initiative.epics.length > 0) {
          return {
            action: "regenerate_section",
            target: "acceptance_criteria",
            data: {
              improvementType: "detail_enhancement",
              focusArea: "acceptance_criteria",
            },
            explanation:
              "Improving acceptance criteria details for existing stories",
          };
        } else {
          return {
            action: "create_plan",
            data: {
              projectDescription: userMessage,
            },
            explanation: "Creating new agile plan (no existing content found)",
          };
        }

      case "add_story":
        return {
          action: "add_story",
          target: intent.targets[0] || "first_epic",
          data: {
            title: this.extractStoryTitle(userMessage),
            description: `Story based on: ${userMessage}`,
            priority: "medium",
            acceptanceCriteria: [
              `Implement ${this.extractStoryTitle(userMessage)}`,
            ],
          },
          explanation: "Adding new user story based on your request",
        };

      case "add_epic":
        return {
          action: "add_epic",
          data: {
            name: this.extractEpicName(userMessage),
            description: `Epic for ${this.extractEpicName(userMessage)}`,
            stories: [],
          },
          explanation: "Creating new epic based on your request",
        };

      case "create_plan":
        // Only create new plan if no existing content
        if (!canvas || canvas.initiative.epics.length === 0) {
          return {
            action: "create_plan",
            data: {
              projectDescription: userMessage,
            },
            explanation: "Creating new agile plan based on your description",
          };
        } else {
          return {
            action: "analyze",
            explanation:
              "Analyzing existing plan to provide improvement suggestions",
          };
        }

      default:
        return {
          action: "analyze",
          explanation: "Analyzing your request and current project state",
        };
    }
  }

  private extractStoryTitle(message: string): string {
    // Try to extract meaningful title from user message
    const quoted = message.match(/"([^"]+)"/);
    if (quoted) return quoted[1];

    // Extract after "add story" or similar
    const afterKeyword = message.match(
      /(?:add|create|new)\s+story[:\s]+([^\n,\.]+)/i,
    );
    if (afterKeyword) return afterKeyword[1].trim();

    // Fallback
    return message.length > 50 ? message.substring(0, 47) + "..." : message;
  }

  private extractEpicName(message: string): string {
    const quoted = message.match(/"([^"]+)"/);
    if (quoted) return quoted[1];

    const afterKeyword = message.match(
      /(?:add|create|new)\s+epic[:\s]+([^\n,\.]+)/i,
    );
    if (afterKeyword) return afterKeyword[1].trim();

    return message.length > 30 ? message.substring(0, 27) + "..." : message;
  }

  // Apply canvas updates based on agent actions
  applyCanvasUpdate(canvas: ProjectCanvas, action: AgentAction): ProjectCanvas {
    const updatedCanvas = JSON.parse(JSON.stringify(canvas)); // Deep clone

    switch (action.action) {
      case "add_story":
        return this.addStoryToCanvas(updatedCanvas, action);
      case "update_story":
        return this.updateStoryInCanvas(updatedCanvas, action);
      case "delete_story":
        return this.deleteStoryFromCanvas(updatedCanvas, action);
      case "add_epic":
        return this.addEpicToCanvas(updatedCanvas, action);
      case "update_epic":
        return this.updateEpicInCanvas(updatedCanvas, action);
      case "delete_epic":
        return this.deleteEpicFromCanvas(updatedCanvas, action);
      case "regenerate_section":
        return this.regenerateCanvasSection(updatedCanvas, action);
      default:
        return updatedCanvas;
    }
  }

  private addStoryToCanvas(
    canvas: ProjectCanvas,
    action: AgentAction,
  ): ProjectCanvas {
    const targetEpic =
      canvas.initiative.epics.find(
        (epic) =>
          epic.id === action.target ||
          epic.name.toLowerCase().includes(action.target?.toLowerCase() || ""),
      ) || canvas.initiative.epics[0];

    if (targetEpic && action.data) {
      const newStory: Story = {
        id: `story_${Date.now()}`,
        title: action.data.title || "New Story",
        description: action.data.description || "",
        acceptanceCriteria: action.data.acceptanceCriteria || [],
        priority: action.data.priority || "medium",
        storyPoints: action.data.storyPoints,
        status: action.data.status || "todo",
      };
      targetEpic.stories.push(newStory);
    }

    return canvas;
  }

  private updateStoryInCanvas(
    canvas: ProjectCanvas,
    action: AgentAction,
  ): ProjectCanvas {
    for (const epic of canvas.initiative.epics) {
      const story = epic.stories.find(
        (s) =>
          s.id === action.target ||
          s.title.toLowerCase().includes(action.target?.toLowerCase() || ""),
      );
      if (story && action.data) {
        // Whitelisted fields only — Object.assign would let the agent payload
        // overwrite identity fields (id, ownerId, projectId, createdAt, etc.).
        const allowedStoryFields = [
          "title",
          "description",
          "acceptanceCriteria",
          "priority",
          "storyPoints",
          "status",
          "assigneeId",
          "labels",
        ] as const;
        for (const key of allowedStoryFields) {
          if (Object.prototype.hasOwnProperty.call(action.data, key)) {
            (story as any)[key] = (action.data as any)[key];
          }
        }
        break;
      }
    }
    return canvas;
  }

  private deleteStoryFromCanvas(
    canvas: ProjectCanvas,
    action: AgentAction,
  ): ProjectCanvas {
    for (const epic of canvas.initiative.epics) {
      const storyIndex = epic.stories.findIndex(
        (s) =>
          s.id === action.target ||
          s.title.toLowerCase().includes(action.target?.toLowerCase() || ""),
      );
      if (storyIndex !== -1) {
        epic.stories.splice(storyIndex, 1);
        break;
      }
    }
    return canvas;
  }

  private addEpicToCanvas(
    canvas: ProjectCanvas,
    action: AgentAction,
  ): ProjectCanvas {
    if (action.data) {
      const newEpic: Epic = {
        id: `epic_${Date.now()}`,
        name: action.data.name || "New Epic",
        description: action.data.description || "",
        stories: action.data.stories || [],
      };
      canvas.initiative.epics.push(newEpic);
    }
    return canvas;
  }

  private updateEpicInCanvas(
    canvas: ProjectCanvas,
    action: AgentAction,
  ): ProjectCanvas {
    const epic = canvas.initiative.epics.find(
      (e) =>
        e.id === action.target ||
        e.name.toLowerCase().includes(action.target?.toLowerCase() || ""),
    );
    if (epic && action.data) {
      // Whitelisted fields only — never let agent payload overwrite identity fields.
      const allowedEpicFields = [
        "name",
        "description",
        "priority",
        "status",
        "color",
        "labels",
      ] as const;
      for (const key of allowedEpicFields) {
        if (Object.prototype.hasOwnProperty.call(action.data, key)) {
          (epic as any)[key] = (action.data as any)[key];
        }
      }
    }
    return canvas;
  }

  private deleteEpicFromCanvas(
    canvas: ProjectCanvas,
    action: AgentAction,
  ): ProjectCanvas {
    const epicIndex = canvas.initiative.epics.findIndex(
      (e) =>
        e.id === action.target ||
        e.name.toLowerCase().includes(action.target?.toLowerCase() || ""),
    );
    if (epicIndex !== -1) {
      canvas.initiative.epics.splice(epicIndex, 1);
    }
    return canvas;
  }

  private regenerateCanvasSection(
    canvas: ProjectCanvas,
    action: AgentAction,
  ): ProjectCanvas {
    // For now, this is a placeholder that enhances acceptance criteria
    // In practice, this would call the AI service to regenerate specific sections

    if (action.data?.focusArea === "acceptance_criteria") {
      // Enhance acceptance criteria for all stories
      canvas.initiative.epics.forEach((epic) => {
        epic.stories.forEach((story) => {
          if (story.acceptanceCriteria.length <= 3) {
            // Add more detailed acceptance criteria
            const enhancedCriteria = [
              ...story.acceptanceCriteria,
              `User interface elements are intuitive and accessible`,
              `Error handling provides clear feedback to users`,
              `Performance meets acceptable response time requirements`,
              `Data validation ensures input integrity`,
            ];
            story.acceptanceCriteria = enhancedCriteria.slice(0, 6); // Keep max 6 criteria
          }
        });
      });
    }

    return canvas;
  }
}
