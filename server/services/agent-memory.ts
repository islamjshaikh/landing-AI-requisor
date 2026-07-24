/**
 * Shared agent memory layer.
 *
 * Wires the existing (previously orphaned) memory infrastructure
 * (`chat_sessions`, `chat_messages`, `chat_embeddings`, MemoryManager) into a
 * thin pre-call / post-call API any agent can use without rewriting its
 * shape.
 *
 *   const ctx = { userId, agentName: "deep-intel-v2", retrieve: true };
 *   const recall = await recallMemory(userQuery, ctx);
 *   const sysHeader = formatMemoryForPrompt(recall);
 *
 *   // …call the model with `sysHeader` prepended to the system prompt…
 *
 *   await persistMemory({ ctx, userQuery, agentResponse });
 *
 * Three behaviours match the spec:
 *
 *   • RETRIEVAL — `recallMemory` returns top-K semantic matches from
 *     `chat_embeddings` and the most recent N turns from `chat_messages`.
 *   • WRITE RULES — `persistMemory` always logs a turn into `chat_messages`,
 *     but only mints an embedding entry when `isWorthPersisting` flags the
 *     content as a preference / decision / fact / goal.
 *   • COMPRESSION — When session turns exceed `COMPRESS_THRESHOLD`, older
 *     turns are summarised into a single embedding and deleted.
 */

import crypto from "crypto";
import { db } from "../db";
import { chatMessages, chatSessions } from "@shared/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { memoryManager } from "./memory-manager";

export interface AgentMemoryContext {
  /** Caller-scoped identity. If missing, all memory ops become no-ops. */
  userId: string | null | undefined;
  /** Stable agent slug used as a session title and for analytics. */
  agentName: string;
  /** Conversation id. Auto-derived per (userId, agentName) when absent. */
  sessionId?: string;
  /** Optional project scope. */
  projectId?: number | null;
  /** Pull prior memory before the call. Off for one-shot transformers. */
  retrieve?: boolean;
  /** Roll old turns into a summary once they exceed the threshold. */
  compress?: boolean;
  /** Free-form metadata stored on each embedding row. */
  metadata?: Record<string, any>;
}

export interface RetrievedMemory {
  similar: Array<{ content: string; metadata: any; similarity: number }>;
  recent: Array<{ role: string; content: string }>;
}

const COMPRESS_THRESHOLD = 30; // turns
const COMPRESS_KEEP = 10; // most-recent turns to retain verbatim

/** Stable per-(agent, user) session id when the caller hasn't supplied one. */
function deriveSessionId(ctx: AgentMemoryContext): string {
  if (ctx.sessionId) return ctx.sessionId;
  const seed = `${ctx.agentName}:${ctx.userId ?? "anon"}`;
  return (
    "auto-" +
    crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16)
  );
}

/** Heuristic for deciding whether content deserves long-term embedding storage. */
function isWorthPersisting(content: string): boolean {
  if (!content || content.length < 12) return false;
  const lc = content.toLowerCase();
  return (
    /\b(prefer|always|never|i (like|hate|want|need)|my (team|project|company|name|email|stack))\b/.test(lc) ||
    /\b(decided|decision|policy|rule|requirement|constraint|deadline|due|by\s+\w+day)\b/.test(lc) ||
    /\b(goal|objective|kpi|milestone|target)\b/.test(lc)
  );
}

/** Pull semantic matches + recent turns into a compact bundle. No-ops if no userId. */
export async function recallMemory(
  query: string,
  ctx: AgentMemoryContext,
  opts: { topK?: number; recentTurns?: number } = {},
): Promise<RetrievedMemory> {
  if (!ctx.retrieve || !ctx.userId) return { similar: [], recent: [] };
  const topK = opts.topK ?? 4;
  const recentTurns = opts.recentTurns ?? 6;
  const sessionId = deriveSessionId(ctx);

  const similarP = memoryManager.search(query, topK).catch(() => []);
  const recentP = db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(recentTurns)
    .catch(() => [] as any[]);

  const [similar, recent] = await Promise.all([similarP, recentP]);

  return {
    similar: similar as any[],
    recent: (recent as any[]).reverse(), // flip to chronological for the model
  };
}

/** Render retrieved memory as a system-prompt header. Empty string if nothing. */
export function formatMemoryForPrompt(mem: RetrievedMemory): string {
  if (!mem.similar.length && !mem.recent.length) return "";
  const parts: string[] = [];
  if (mem.similar.length) {
    parts.push(
      "## Relevant long-term memory\n" +
        mem.similar
          .map(
            (s, i) =>
              `${i + 1}. (sim=${(s.similarity ?? 0).toFixed(2)}) ${(s.content ?? "")
                .toString()
                .slice(0, 300)}`,
          )
          .join("\n"),
    );
  }
  if (mem.recent.length) {
    parts.push(
      "## Recent turns in this conversation\n" +
        mem.recent
          .map((t) => `[${t.role}] ${(t.content || "").slice(0, 400)}`)
          .join("\n"),
    );
  }
  return parts.join("\n\n");
}

/** Persist a turn to chat_messages and optionally to chat_embeddings. */
export async function persistMemory(opts: {
  ctx: AgentMemoryContext;
  userQuery?: string;
  agentResponse?: string;
  insights?: any;
  actions?: any;
  suggestedPrompts?: any;
}): Promise<void> {
  const { ctx, userQuery, agentResponse } = opts;
  if (!ctx.userId) return;

  const sessionId = deriveSessionId(ctx);

  // Make sure the session row exists. INSERT ... ON CONFLICT DO NOTHING.
  try {
    await db
      .insert(chatSessions)
      .values({
        userId: ctx.userId,
        projectId: ctx.projectId ?? null,
        sessionId,
        title: ctx.agentName,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.warn(
      "[agent-memory] chat session upsert failed:",
      (err as any)?.message,
    );
  }

  // Append turn rows.
  try {
    if (userQuery) {
      await db.insert(chatMessages).values({
        sessionId,
        role: "user",
        content: userQuery.slice(0, 8000),
      });
    }
    if (agentResponse) {
      await db.insert(chatMessages).values({
        sessionId,
        role: "assistant",
        content: agentResponse.slice(0, 16000),
        insights: opts.insights ? JSON.stringify(opts.insights) : null,
        actions: opts.actions ? JSON.stringify(opts.actions) : null,
        suggestedPrompts: opts.suggestedPrompts
          ? JSON.stringify(opts.suggestedPrompts)
          : null,
      });
    }
  } catch (err) {
    console.warn(
      "[agent-memory] chat_messages insert failed:",
      (err as any)?.message,
    );
  }

  // Selectively mint embeddings for high-signal content only.
  try {
    const candidates: Array<[string, "user" | "assistant"]> = [];
    if (userQuery && isWorthPersisting(userQuery)) {
      candidates.push([userQuery, "user"]);
    }
    if (agentResponse && isWorthPersisting(agentResponse)) {
      candidates.push([agentResponse, "assistant"]);
    }
    for (const [text, role] of candidates) {
      await memoryManager.storeMessage(text, {
        ...(ctx.metadata || {}),
        userId: ctx.userId,
        agentName: ctx.agentName,
        sessionId,
        role,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn(
      "[agent-memory] embedding store failed:",
      (err as any)?.message,
    );
  }

  if (ctx.compress) {
    await maybeCompress(sessionId).catch(() => undefined);
  }
}

async function maybeCompress(sessionId: string): Promise<void> {
  const all = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt));

  if (all.length <= COMPRESS_THRESHOLD) return;

  // `all` is desc; the rows older than the kept window are at the tail.
  const old = (all as any[]).slice(COMPRESS_KEEP).reverse();
  if (old.length === 0) return;

  const summaryText = old
    .map(
      (m) =>
        `${(m.role || "?").toUpperCase()}: ${(m.content || "").slice(0, 200)}`,
    )
    .join("\n");

  await memoryManager.storeMessage(
    `[SUMMARY of ${old.length} prior turns in session ${sessionId}]\n${summaryText}`,
    {
      sessionId,
      role: "summary",
      compressed: true,
      count: old.length,
      timestamp: new Date().toISOString(),
    },
  );

  const oldIds = old.map((m: any) => m.id).filter((x) => typeof x === "number");
  if (oldIds.length) {
    await db
      .delete(chatMessages)
      .where(inArray(chatMessages.id, oldIds))
      .catch((err) =>
        console.warn(
          "[agent-memory] compression delete failed:",
          (err as any)?.message,
        ),
      );
  }
}
