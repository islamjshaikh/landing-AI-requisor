import OpenAI from "openai";
import { getAiClient } from "./ai-provider";
import { trackTokenUsage, getModelForBudget } from "./token-tracker";

const openai = (getAiClient() as any);

export interface ParsedInsight {
  title: string;
  content: string;
}

export interface ParsedContext {
  problems: ParsedInsight[];
  features: ParsedInsight[];
  decisions: ParsedInsight[];
  insights: ParsedInsight[];
  questions: ParsedInsight[];
}

interface RawParsedResponse {
  problems?: Array<{ title?: unknown; content?: unknown }>;
  features?: Array<{ title?: unknown; content?: unknown }>;
  decisions?: Array<{ title?: unknown; content?: unknown }>;
  insights?: Array<{ title?: unknown; content?: unknown }>;
  questions?: Array<{ title?: unknown; content?: unknown }>;
}

const EXTRACTION_PROMPT = `You are an expert product intelligence analyst. Your job is to extract structured insights from raw text input. The input may come from various sources: ChatGPT or Claude conversations, meeting transcripts, user feedback, brainstorming notes, or unstructured product discussions.

Extract and categorize the content into these 5 categories:

1. **Problems** — User pain points, complaints, friction, bugs, or issues mentioned
2. **Features** — Feature ideas, requests, suggestions, or product improvements discussed
3. **Decisions** — Decisions that were made, conclusions reached, or direction chosen
4. **Insights** — Interesting observations, patterns, learnings, or strategic takeaways
5. **Questions** — Open questions, unknowns, things to investigate, or unresolved items

Rules:
- Each extracted item MUST have a short, descriptive "title" (5-10 words) and a "content" field with the full detail/context
- DO NOT copy raw text verbatim — synthesize and clean it up while preserving the meaning
- Merge duplicates — if the same point is mentioned multiple times, combine into one item
- Be selective — only extract genuinely useful product intelligence, not small talk or filler
- If a conversation is between a human and an AI (ChatGPT/Claude), focus on extracting the human's actual needs and the AI's substantive recommendations
- It's okay for a category to be empty if nothing relevant was found
- Aim for quality over quantity — 3 high-quality insights are better than 10 low-quality ones

Respond ONLY with valid JSON matching this exact structure:
{
  "problems": [{"title": "...", "content": "..."}],
  "features": [{"title": "...", "content": "..."}],
  "decisions": [{"title": "...", "content": "..."}],
  "insights": [{"title": "...", "content": "..."}],
  "questions": [{"title": "...", "content": "..."}]
}`;

function isValidInsight(item: { title?: unknown; content?: unknown }): item is { title: string; content: string } {
  return typeof item.title === "string" && item.title.trim().length > 0
    && typeof item.content === "string" && item.content.trim().length > 0;
}

export async function parseContext(rawText: string, source: string, userId?: string): Promise<ParsedContext> {
  const truncatedText = rawText.slice(0, 50000);

  const contextModel = userId ? await getModelForBudget(userId, "gpt-4o") : "gpt-4o";
  const completion = await openai.chat.completions.create({
    model: contextModel,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: `Source: ${source}\n\n---\n\n${truncatedText}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  if (userId && completion.usage) {
    trackTokenUsage(userId, "context-brain", contextModel, completion.usage).catch(() => {});
  }

  const responseText = completion.choices[0]?.message?.content || "{}";
  let parsed: RawParsedResponse;
  try {
    parsed = JSON.parse(responseText) as RawParsedResponse;
  } catch {
    parsed = {};
  }

  const result: ParsedContext = {
    problems: [],
    features: [],
    decisions: [],
    insights: [],
    questions: [],
  };

  for (const key of Object.keys(result) as Array<keyof ParsedContext>) {
    const rawItems = parsed[key];
    if (Array.isArray(rawItems)) {
      result[key] = rawItems
        .filter(isValidInsight)
        .map((item) => ({
          title: item.title.trim(),
          content: item.content.trim(),
        }));
    }
  }

  return result;
}

interface ChatGPTMappingNode {
  parent?: string;
  children?: string[];
  message?: {
    author?: { role?: string };
    content?: { parts?: string[] };
  };
}

export interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;
  mapping: Record<string, ChatGPTMappingNode>;
}

export function extractChatGPTConversationList(jsonContent: string): Array<{ id: string; title: string; messageCount: number; date: string }> {
  const conversations: ChatGPTConversation[] = JSON.parse(jsonContent);

  if (!Array.isArray(conversations)) {
    throw new Error("Invalid ChatGPT export format: expected an array of conversations");
  }

  return conversations.map((conv) => {
    const messageCount = Object.values(conv.mapping || {}).filter(
      (node) => node.message?.content?.parts?.length
    ).length;

    return {
      id: conv.id,
      title: conv.title || "Untitled",
      messageCount,
      date: new Date(conv.create_time * 1000).toISOString().split("T")[0],
    };
  });
}

export function extractChatGPTConversationText(jsonContent: string, conversationIds: string[]): Map<string, string> {
  const conversations: ChatGPTConversation[] = JSON.parse(jsonContent);
  const result = new Map<string, string>();

  for (const conv of conversations) {
    if (!conversationIds.includes(conv.id)) continue;

    const mapping = conv.mapping || {};
    const ordered = buildMessageOrder(mapping);
    const messages: string[] = [];

    for (const nodeId of ordered) {
      const node = mapping[nodeId];
      const msg = node?.message;
      if (!msg?.content?.parts?.length) continue;
      const role = msg.author?.role || "unknown";
      const text = msg.content.parts.join("\n").trim();
      if (!text) continue;
      messages.push(`[${role}]: ${text}`);
    }

    result.set(conv.id, `Conversation: ${conv.title}\n\n${messages.join("\n\n")}`);
  }

  return result;
}

function buildMessageOrder(mapping: Record<string, ChatGPTMappingNode>): string[] {
  const childToParent = new Map<string, string>();
  const parentToChildren = new Map<string, string[]>();
  const allIds = new Set(Object.keys(mapping));

  for (const [id, node] of Object.entries(mapping)) {
    const parent = node.parent;
    if (parent && allIds.has(parent)) {
      childToParent.set(id, parent);
      if (!parentToChildren.has(parent)) parentToChildren.set(parent, []);
      parentToChildren.get(parent)!.push(id);
    }
  }

  let rootId: string | undefined;
  for (const id of allIds) {
    if (!childToParent.has(id)) {
      rootId = id;
      break;
    }
  }

  if (!rootId) return Object.keys(mapping);

  const ordered: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    ordered.push(current);
    const children = parentToChildren.get(current) || [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }

  return ordered;
}
