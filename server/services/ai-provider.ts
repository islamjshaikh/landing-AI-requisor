/**
 * AI provider abstraction ("Bring Your Own Claude key").
 *
 * Goal: when a user supplies their own Anthropic Claude key, ALL chat /
 * analysis AI runs through Claude on their own billing — the platform's
 * OpenAI key is never touched for that user, and their usage is never gated
 * by token caps. Default users are unchanged (platform OpenAI, capped).
 *
 * The app has 30+ modules that create a shared client at load time and call
 * `.chat.completions.create(...)`. Instead of threading a userId through
 * every call, those modules use `getAiClient()`, and this module resolves the
 * current user (via ai-context AsyncLocalStorage) and routes accordingly. The
 * returned client mimics the OpenAI SDK surface used across the codebase
 * (`chat.completions.create`, `audio.transcriptions.create`) and, for Claude,
 * translates request params and normalises responses back to OpenAI shape so
 * existing call sites keep working unchanged.
 */
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { userAiSettings, type UserAiSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  encryptAes256Gcm,
  decryptAes256Gcm,
  deriveAesKeyFromSecret,
} from "../security/helpers";
import { getContextUserId } from "./ai-context";

// ---------------------------------------------------------------------------
// Encryption key for at-rest AI secrets. Reuses a stable existing secret so
// no boot-time interruption is required; can be overridden with a dedicated
// AI_KEYS_ENCRYPTION_KEY. Fails only when a user actually tries to save a key
// with no secret configured (never silently).
// ---------------------------------------------------------------------------
function getEncryptionKey(): Buffer {
  const secret =
    process.env.AI_KEYS_ENCRYPTION_KEY ||
    process.env.MASTODON_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET;
  return deriveAesKeyFromSecret(secret, "AI_KEYS_ENCRYPTION_KEY");
}

// ---------------------------------------------------------------------------
// Platform client singletons (default / non-BYOK users).
// ---------------------------------------------------------------------------
const platformOpenAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
});

// ---------------------------------------------------------------------------
// Resolved per-user config with a short in-memory cache.
// ---------------------------------------------------------------------------
export interface ResolvedAiConfig {
  userId?: string;
  provider: "platform" | "anthropic";
  /** True when the user has an own Claude key active (billing + no caps). */
  hasOwnKey: boolean;
  anthropicApiKey?: string;
  transcriptionApiKey?: string;
  zeroRetention: boolean;
}

const CONFIG_TTL_MS = 30_000;
const configCache = new Map<string, { value: ResolvedAiConfig; expires: number }>();

/** Drop cached config for a user (call after settings change). */
export function invalidateAiConfig(userId: string): void {
  configCache.delete(userId);
}

async function loadSettingsRow(userId: string): Promise<UserAiSettings | undefined> {
  const rows = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId));
  return rows[0];
}

const PLATFORM_CONFIG: ResolvedAiConfig = {
  provider: "platform",
  hasOwnKey: false,
  zeroRetention: true,
};

/** Resolve the effective AI config for a user (cached). */
export async function resolveAiConfig(userId?: string): Promise<ResolvedAiConfig> {
  const uid = userId ?? getContextUserId();
  if (!uid) return { ...PLATFORM_CONFIG };

  const cached = configCache.get(uid);
  if (cached && cached.expires > Date.now()) return cached.value;

  // NOTE: we deliberately do NOT wrap the settings lookup in a fall-back-to-
  // platform try/catch. If we cannot determine a user's provider (transient DB
  // error), we must FAIL CLOSED rather than risk routing an own-key user to the
  // platform OpenAI key. The error propagates to the caller and the AI call
  // fails loudly. Nothing is cached on failure.
  const row = await loadSettingsRow(uid);
  let value: ResolvedAiConfig = { ...PLATFORM_CONFIG, userId: uid };
  if (row && row.provider === "anthropic") {
    const key = getEncryptionKey();
    // A user who selected "anthropic" is ALWAYS treated as own-key (caps
    // bypassed, platform key never used). If the stored key can't be decrypted
    // we leave anthropicApiKey undefined; chatCreateForUser then throws instead
    // of silently falling back to platform.
    const anthropicApiKey = row.anthropicApiKeyEncrypted
      ? safeDecrypt(row.anthropicApiKeyEncrypted, key)
      : undefined;
    const transcriptionApiKey = row.transcriptionApiKeyEncrypted
      ? safeDecrypt(row.transcriptionApiKeyEncrypted, key)
      : undefined;
    value = {
      userId: uid,
      provider: "anthropic",
      hasOwnKey: true,
      anthropicApiKey,
      transcriptionApiKey,
      zeroRetention: row.zeroRetention,
    };
  } else if (row) {
    // Platform provider: a transcription key may still be configured.
    const key = getEncryptionKey();
    const transcriptionApiKey = row.transcriptionApiKeyEncrypted
      ? safeDecrypt(row.transcriptionApiKeyEncrypted, key)
      : undefined;
    value = {
      ...PLATFORM_CONFIG,
      userId: uid,
      transcriptionApiKey,
      zeroRetention: row.zeroRetention,
    };
  }

  configCache.set(uid, { value, expires: Date.now() + CONFIG_TTL_MS });
  return value;
}

/**
 * Thrown when an own-key (Claude) user's key is unavailable (missing or
 * undecryptable). We fail closed here rather than fall back to the platform
 * OpenAI key, which must NEVER be used for own-key users.
 */
export class AiKeyUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiKeyUnavailableError";
  }
}

function safeDecrypt(payload: string, key: Buffer): string | undefined {
  try {
    return decryptAes256Gcm(payload, key);
  } catch (err) {
    console.error("[ai-provider] Failed to decrypt stored AI key:", err);
    return undefined;
  }
}

/** Lightweight boolean used by the budget layer to bypass token caps. */
export async function userHasOwnKey(userId?: string): Promise<boolean> {
  const cfg = await resolveAiConfig(userId);
  return cfg.hasOwnKey;
}

/**
 * True when the app must NOT persist/log raw prompt or response bodies for this
 * user. This is enforced for own-key (Claude) users who have the zero-data-
 * retention posture enabled — the client requires that raw request/response
 * content is not retained by the platform on their behalf.
 *
 * Fails SAFE: if we cannot resolve the user's config (transient DB error), we
 * suppress retention rather than risk persisting content we shouldn't.
 */
export async function shouldSuppressAiRetention(
  userId?: string,
): Promise<boolean> {
  try {
    const cfg = await resolveAiConfig(userId);
    return cfg.hasOwnKey && cfg.zeroRetention;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// OpenAI -> Anthropic translation.
// ---------------------------------------------------------------------------
const MODEL_MAP: Record<string, string> = {
  "gpt-4o": "claude-3-5-sonnet-latest",
  "gpt-4-turbo": "claude-3-5-sonnet-latest",
  "gpt-4": "claude-3-5-sonnet-latest",
  "gpt-4o-mini": "claude-3-5-haiku-latest",
  "gpt-3.5-turbo": "claude-3-5-haiku-latest",
};

function mapModel(openaiModel: string | undefined): string {
  if (!openaiModel) return "claude-3-5-sonnet-latest";
  return MODEL_MAP[openaiModel] || "claude-3-5-sonnet-latest";
}

function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : part?.type === "text"
            ? part.text ?? ""
            : "",
      )
      .join("");
  }
  return "";
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature?: number;
}

function toAnthropicRequest(params: any): AnthropicRequest {
  const systemParts: string[] = [];
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const m of params.messages || []) {
    if (m.role === "system") {
      systemParts.push(extractText(m.content));
    } else if (m.role === "assistant") {
      messages.push({ role: "assistant", content: extractText(m.content) });
    } else {
      // Treat user/tool/function/etc. as user input.
      messages.push({ role: "user", content: extractText(m.content) });
    }
  }

  // Anthropic requires the conversation to start with a user turn.
  if (messages.length === 0 || messages[0].role !== "user") {
    messages.unshift({ role: "user", content: "" });
  }

  const wantsJson = params.response_format?.type === "json_object";
  if (wantsJson) {
    systemParts.push(
      "You must respond with ONLY a single valid JSON object. Do not wrap it in markdown code fences and do not include any prose before or after the JSON.",
    );
  }

  const maxTokens = Math.min(
    typeof params.max_tokens === "number" && params.max_tokens > 0
      ? params.max_tokens
      : 4096,
    8192,
  );

  const req: AnthropicRequest = {
    model: mapModel(params.model),
    max_tokens: maxTokens,
    messages,
  };
  if (systemParts.length > 0) req.system = systemParts.join("\n\n");
  if (typeof params.temperature === "number") {
    req.temperature = Math.max(0, Math.min(params.temperature, 1));
  }
  return req;
}

interface AnthropicToolset {
  tools: Array<{ name: string; description?: string; input_schema: any }>;
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
  /** True when the caller used the legacy `functions`/`function_call` API. */
  legacy: boolean;
}

/**
 * Translate OpenAI function-calling / tool-calling params into Anthropic's
 * `tools` + `tool_choice`. Supports both the modern `tools`/`tool_choice` API
 * and the legacy `functions`/`function_call` API. Returns undefined when the
 * request uses neither.
 */
function toAnthropicTools(params: any): AnthropicToolset | undefined {
  const emptySchema = { type: "object", properties: {} };

  if (Array.isArray(params.tools) && params.tools.length > 0) {
    const tools = params.tools
      .filter((t: any) => t?.type === "function" && t.function?.name)
      .map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters || emptySchema,
      }));
    if (tools.length === 0) return undefined;

    let tool_choice: AnthropicToolset["tool_choice"];
    const tc = params.tool_choice;
    if (tc === "required") tool_choice = { type: "any" };
    else if (tc === "auto" || tc === undefined || tc === "none") tool_choice = { type: "auto" };
    else if (tc?.type === "function" && tc.function?.name) tool_choice = { type: "tool", name: tc.function.name };
    return { tools, tool_choice, legacy: false };
  }

  if (Array.isArray(params.functions) && params.functions.length > 0) {
    const tools = params.functions
      .filter((f: any) => f?.name)
      .map((f: any) => ({
        name: f.name,
        description: f.description,
        input_schema: f.parameters || emptySchema,
      }));
    if (tools.length === 0) return undefined;

    let tool_choice: AnthropicToolset["tool_choice"];
    const fc = params.function_call;
    if (fc === "none") tool_choice = undefined;
    else if (fc === "auto" || fc === undefined) tool_choice = { type: "auto" };
    else if (fc?.name) tool_choice = { type: "tool", name: fc.name };
    return { tools, tool_choice, legacy: true };
  }

  return undefined;
}

/** Strip accidental ```json fences the model may add despite instructions. */
function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

function anthropicToOpenAICompletion(resp: any, wantsJson: boolean, legacy = false): any {
  let text = extractText(resp?.content);
  if (wantsJson) text = stripJsonFences(text);
  const inputTokens = resp?.usage?.input_tokens ?? 0;
  const outputTokens = resp?.usage?.output_tokens ?? 0;

  // Map Anthropic tool_use blocks back to the OpenAI tool-calling shape the
  // call sites expect (message.tool_calls, or legacy message.function_call).
  const toolUseBlocks = Array.isArray(resp?.content)
    ? resp.content.filter((b: any) => b?.type === "tool_use")
    : [];

  const message: any = { role: "assistant", content: text || null };
  let finishReason: string = resp?.stop_reason === "max_tokens" ? "length" : "stop";

  if (toolUseBlocks.length > 0) {
    finishReason = "tool_calls";
    const toolCalls = toolUseBlocks.map((b: any) => ({
      id: b.id ?? `call_${Math.random().toString(36).slice(2)}`,
      type: "function",
      function: {
        name: b.name,
        arguments: JSON.stringify(b.input ?? {}),
      },
    }));
    if (legacy) {
      // Legacy functions API: single function_call on the message.
      message.function_call = {
        name: toolCalls[0].function.name,
        arguments: toolCalls[0].function.arguments,
      };
      finishReason = "function_call";
    } else {
      message.tool_calls = toolCalls;
    }
  }

  return {
    id: resp?.id ?? "anthropic",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: resp?.model ?? "claude",
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };
}

/** Adapt an Anthropic message stream into OpenAI chat-chunk shape. */
async function* anthropicStreamToOpenAI(
  anthropicStream: AsyncIterable<any>,
  includeUsage: boolean,
): AsyncGenerator<any> {
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const event of anthropicStream) {
    if (event.type === "message_start") {
      inputTokens = event.message?.usage?.input_tokens ?? inputTokens;
      outputTokens = event.message?.usage?.output_tokens ?? outputTokens;
    } else if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      yield {
        id: "anthropic",
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
      };
    } else if (event.type === "message_delta") {
      if (event.usage?.output_tokens != null) outputTokens = event.usage.output_tokens;
    }
  }
  const finalChunk: any = {
    id: "anthropic",
    object: "chat.completion.chunk",
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };
  if (includeUsage) {
    finalChunk.usage = {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    };
  }
  yield finalChunk;
}

// ---------------------------------------------------------------------------
// Core routing.
// ---------------------------------------------------------------------------
export async function chatCreateForUser(userId: string | undefined, params: any): Promise<any> {
  const cfg = await resolveAiConfig(userId);

  if (cfg.provider !== "anthropic") {
    // Default path: platform OpenAI, unchanged behaviour.
    return platformOpenAI.chat.completions.create(params);
  }

  // Own-key (Claude) user. FAIL CLOSED if the key is unavailable — never fall
  // back to the platform OpenAI key.
  if (!cfg.anthropicApiKey) {
    throw new AiKeyUnavailableError(
      "Your Claude API key could not be used (missing or unreadable). Re-enter your Anthropic API key in Settings → AI Provider. The platform key is never used on your behalf.",
    );
  }

  const anthropic = new Anthropic({ apiKey: cfg.anthropicApiKey });
  const wantsJson = params.response_format?.type === "json_object";
  const tools = toAnthropicTools(params);
  const req = toAnthropicRequest(params);
  if (tools) {
    (req as any).tools = tools.tools;
    if (tools.tool_choice) (req as any).tool_choice = tools.tool_choice;
  }

  if (params.stream) {
    const includeUsage = params.stream_options?.include_usage !== false;
    const stream = await anthropic.messages.create({ ...req, stream: true });
    return anthropicStreamToOpenAI(stream as any, includeUsage);
  }

  const resp = await anthropic.messages.create(req);
  return anthropicToOpenAICompletion(resp, wantsJson, !!tools?.legacy);
}

export class TranscriptionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptionUnavailableError";
  }
}

export async function transcriptionCreateForUser(
  userId: string | undefined,
  params: any,
): Promise<any> {
  const cfg = await resolveAiConfig(userId);

  if (cfg.transcriptionApiKey) {
    const client = new OpenAI({ apiKey: cfg.transcriptionApiKey });
    return client.audio.transcriptions.create(params);
  }

  if (cfg.hasOwnKey) {
    // Own-key (Claude) user with no transcription key. Claude cannot
    // transcribe audio, and we must never silently fall back to the
    // platform key. Fail loudly with a clear, actionable message.
    throw new TranscriptionUnavailableError(
      "Audio transcription is disabled because you're using your own Claude key, which can't transcribe audio. Add a transcription API key (OpenAI Whisper) in Settings → AI Provider to enable transcription, or remove your Claude key to use the platform's transcription.",
    );
  }

  return platformOpenAI.audio.transcriptions.create(params);
}

// ---------------------------------------------------------------------------
// The drop-in client used by module-level code.
// ---------------------------------------------------------------------------
export interface SmartAiClient {
  chat: { completions: { create: (params: any) => Promise<any> } };
  audio: { transcriptions: { create: (params: any) => Promise<any> } };
}

const smartClient: SmartAiClient = {
  chat: {
    completions: {
      create: (params: any) => chatCreateForUser(getContextUserId(), params),
    },
  },
  audio: {
    transcriptions: {
      create: (params: any) => transcriptionCreateForUser(getContextUserId(), params),
    },
  },
};

/**
 * Returns a client with the OpenAI SDK surface used across the codebase.
 * Routes to the current request's user provider (Claude when a BYO key is
 * active, otherwise platform OpenAI). Use this in place of `new OpenAI(...)`.
 */
export function getAiClient(): SmartAiClient {
  return smartClient;
}

// ---------------------------------------------------------------------------
// Settings management (used by routes). Never returns plaintext keys.
// ---------------------------------------------------------------------------
export interface SafeAiSettings {
  provider: "platform" | "anthropic";
  hasAnthropicKey: boolean;
  anthropicKeyLast4: string | null;
  hasTranscriptionKey: boolean;
  transcriptionKeyLast4: string | null;
  zeroRetention: boolean;
  /** True when the own Claude key is active — token caps do not apply. */
  ownKeyActive: boolean;
}

export async function getSafeAiSettings(userId: string): Promise<SafeAiSettings> {
  const row = await loadSettingsRow(userId);
  if (!row) {
    return {
      provider: "platform",
      hasAnthropicKey: false,
      anthropicKeyLast4: null,
      hasTranscriptionKey: false,
      transcriptionKeyLast4: null,
      zeroRetention: true,
      ownKeyActive: false,
    };
  }
  const hasAnthropicKey = !!row.anthropicApiKeyEncrypted;
  return {
    provider: row.provider === "anthropic" ? "anthropic" : "platform",
    hasAnthropicKey,
    anthropicKeyLast4: row.anthropicKeyLast4 ?? null,
    hasTranscriptionKey: !!row.transcriptionApiKeyEncrypted,
    transcriptionKeyLast4: row.transcriptionKeyLast4 ?? null,
    zeroRetention: row.zeroRetention,
    ownKeyActive: row.provider === "anthropic" && hasAnthropicKey,
  };
}

export interface SaveAiSettingsInput {
  provider?: "platform" | "anthropic";
  /** Provide to set/replace. Empty string clears. Undefined leaves as-is. */
  anthropicApiKey?: string;
  transcriptionApiKey?: string;
  zeroRetention?: boolean;
}

export async function saveAiSettings(
  userId: string,
  input: SaveAiSettingsInput,
): Promise<SafeAiSettings> {
  const key = getEncryptionKey();
  const existing = await loadSettingsRow(userId);

  const update: Record<string, any> = { updatedAt: new Date() };

  if (input.provider) update.provider = input.provider;
  if (typeof input.zeroRetention === "boolean") update.zeroRetention = input.zeroRetention;

  if (input.anthropicApiKey !== undefined) {
    const trimmed = input.anthropicApiKey.trim();
    if (trimmed === "") {
      update.anthropicApiKeyEncrypted = null;
      update.anthropicKeyLast4 = null;
    } else {
      update.anthropicApiKeyEncrypted = encryptAes256Gcm(trimmed, key);
      update.anthropicKeyLast4 = trimmed.slice(-4);
    }
  }

  if (input.transcriptionApiKey !== undefined) {
    const trimmed = input.transcriptionApiKey.trim();
    if (trimmed === "") {
      update.transcriptionApiKeyEncrypted = null;
      update.transcriptionKeyLast4 = null;
    } else {
      update.transcriptionApiKeyEncrypted = encryptAes256Gcm(trimmed, key);
      update.transcriptionKeyLast4 = trimmed.slice(-4);
    }
  }

  if (existing) {
    await db.update(userAiSettings).set(update).where(eq(userAiSettings.userId, userId));
  } else {
    await db.insert(userAiSettings).values({
      userId,
      provider: update.provider ?? "platform",
      anthropicApiKeyEncrypted: update.anthropicApiKeyEncrypted ?? null,
      anthropicKeyLast4: update.anthropicKeyLast4 ?? null,
      transcriptionApiKeyEncrypted: update.transcriptionApiKeyEncrypted ?? null,
      transcriptionKeyLast4: update.transcriptionKeyLast4 ?? null,
      zeroRetention: update.zeroRetention ?? true,
    });
  }

  invalidateAiConfig(userId);
  return getSafeAiSettings(userId);
}

export async function deleteAiSettings(userId: string): Promise<SafeAiSettings> {
  await db.delete(userAiSettings).where(eq(userAiSettings.userId, userId));
  invalidateAiConfig(userId);
  return getSafeAiSettings(userId);
}

/** Validate a Claude key with a tiny live request. Returns null on success. */
export async function testAnthropicKey(apiKey: string): Promise<string | null> {
  const trimmed = apiKey.trim();
  if (!trimmed) return "No API key provided.";
  try {
    const anthropic = new Anthropic({ apiKey: trimmed });
    await anthropic.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 4,
      messages: [{ role: "user", content: "ping" }],
    });
    return null;
  } catch (err: any) {
    const status = err?.status;
    if (status === 401) return "Invalid Claude API key (authentication failed).";
    if (status === 403) return "This Claude API key is not authorised for the Messages API.";
    if (status === 429) return "Claude API key hit a rate limit — the key is valid but currently throttled.";
    return `Could not validate the Claude API key: ${err?.message || "unknown error"}.`;
  }
}

/** Validate an OpenAI-compatible transcription key. Returns null on success. */
export async function testTranscriptionKey(apiKey: string): Promise<string | null> {
  const trimmed = apiKey.trim();
  if (!trimmed) return "No API key provided.";
  try {
    const client = new OpenAI({ apiKey: trimmed });
    await client.models.list();
    return null;
  } catch (err: any) {
    const status = err?.status;
    if (status === 401) return "Invalid transcription API key (authentication failed).";
    return `Could not validate the transcription key: ${err?.message || "unknown error"}.`;
  }
}
