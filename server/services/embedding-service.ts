/**
 * Unified embedding service.
 *
 * Replaces the previously-broken Gemini dependency (GEMINI_API_KEY was never
 * set, so every embedding call failed silently). Embeddings now use OpenAI
 * `text-embedding-3-small` at 768 dimensions, which keeps every existing
 * vector(768) column (chat_embeddings, themes, content_embeddings) valid.
 *
 * Key resolution respects the BYOK posture:
 * - Platform users → the platform OPENAI_API_KEY.
 * - Own-key (Claude) users → their optional OpenAI transcription key if they
 *   supplied one (Claude has no embeddings API). If they haven't, embeddings
 *   are UNAVAILABLE for them — we fail closed and never touch the platform
 *   key on their behalf. Callers degrade to keyword search and flag it.
 *
 * All failures are logged with structured context — never swallowed silently.
 */
import OpenAI from "openai";
import { resolveAiConfig } from "./ai-provider";
import { getContextUserId } from "./ai-context";
import { trackTokenUsage } from "./token-tracker";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 768;

/** Max characters per input sent to the embeddings API. */
const MAX_INPUT_CHARS = 8000;

export class EmbeddingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingUnavailableError";
  }
}

interface ResolvedEmbeddingKey {
  apiKey: string;
  /** True when billing goes to the user's own key (skip budget increments). */
  ownKey: boolean;
}

async function resolveEmbeddingKey(userId?: string): Promise<ResolvedEmbeddingKey> {
  const cfg = await resolveAiConfig(userId);
  if (cfg.hasOwnKey) {
    // Own-key (Claude) user: Claude cannot embed. Use their optional OpenAI
    // transcription key if present; otherwise fail closed (NEVER platform key).
    if (cfg.transcriptionApiKey) {
      return { apiKey: cfg.transcriptionApiKey, ownKey: true };
    }
    throw new EmbeddingUnavailableError(
      "Semantic search is unavailable because you're using your own Claude key, which can't generate embeddings. Add an OpenAI API key under Settings → AI Provider (transcription key) to enable semantic search, or remove your Claude key.",
    );
  }
  const platformKey = process.env.OPENAI_API_KEY;
  if (!platformKey) {
    throw new EmbeddingUnavailableError(
      "No embedding provider key is configured (OPENAI_API_KEY missing).",
    );
  }
  return { apiKey: platformKey, ownKey: false };
}

/** Whether embeddings can currently be generated for this user. */
export async function isEmbeddingAvailable(userId?: string): Promise<boolean> {
  try {
    await resolveEmbeddingKey(userId ?? getContextUserId());
    return true;
  } catch {
    return false;
  }
}

export interface EmbedOptions {
  userId?: string;
  /** Feature label for token tracking (default "embeddings"). */
  feature?: string;
}

/**
 * Generate embeddings for a batch of texts. Returns one 768-dim vector per
 * input, in order. Throws EmbeddingUnavailableError when no key is available,
 * or the provider error on API failure — callers decide how to degrade.
 */
export async function generateEmbeddings(
  texts: string[],
  opts: EmbedOptions = {},
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const userId = opts.userId ?? getContextUserId();
  const inputs = texts.map((t) => (t || "").trim().slice(0, MAX_INPUT_CHARS) || " ");

  const { apiKey, ownKey } = await resolveEmbeddingKey(userId);
  const client = new OpenAI({ apiKey });

  try {
    const resp = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: inputs,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    // Track token usage for platform-billed users (own-key users pay their
    // own provider bill and are never budget-gated).
    if (userId && !ownKey) {
      trackTokenUsage(userId, opts.feature || "embeddings", EMBEDDING_MODEL, {
        prompt_tokens: resp.usage?.prompt_tokens ?? 0,
        completion_tokens: 0,
        total_tokens: resp.usage?.total_tokens ?? resp.usage?.prompt_tokens ?? 0,
      }).catch((err) =>
        console.error("[embedding-service] token tracking failed:", err),
      );
    }

    const byIndex = [...resp.data].sort((a, b) => a.index - b.index);
    return byIndex.map((d) => d.embedding as number[]);
  } catch (err: any) {
    console.error(
      `[embedding-service] embedding generation failed (user=${userId ?? "none"}, inputs=${inputs.length}, model=${EMBEDDING_MODEL}):`,
      err?.message || err,
    );
    throw err;
  }
}

/** Generate a single embedding. See generateEmbeddings. */
export async function generateEmbedding(
  text: string,
  opts: EmbedOptions = {},
): Promise<number[]> {
  const [vec] = await generateEmbeddings([text], opts);
  return vec;
}

/**
 * Soft variant: returns null instead of throwing (logs the failure). Used by
 * call sites that degrade to keyword search.
 */
export async function tryGenerateEmbedding(
  text: string,
  opts: EmbedOptions = {},
): Promise<number[] | null> {
  try {
    if (!text || !text.trim()) return null;
    return await generateEmbedding(text, opts);
  } catch {
    // Already logged with context in generateEmbeddings.
    return null;
  }
}
