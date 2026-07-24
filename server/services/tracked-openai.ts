import OpenAI from "openai";
import { trackTokenUsage, checkTokenBudget } from "./token-tracker";
import {
  chatCreateForUser,
  transcriptionCreateForUser,
  resolveAiConfig,
  getAiClient,
} from "./ai-provider";

let _currentUserId: string | null = null;
let _currentFeature: string | null = null;

export function setTrackingContext(userId: string, feature: string) {
  _currentUserId = userId;
  _currentFeature = feature;
}

export function clearTrackingContext() {
  _currentUserId = null;
  _currentFeature = null;
}

export async function trackedChatCompletion(
  userId: string,
  feature: string,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
): Promise<OpenAI.Chat.ChatCompletion> {
  const cfg = await resolveAiConfig(userId);
  const budgetCheck = cfg.hasOwnKey
    ? { degradeToMini: false }
    : await checkTokenBudget(userId);

  if (budgetCheck.degradeToMini && params.model === "gpt-4o") {
    params = { ...params, model: "gpt-4o-mini" };
  }

  const completion = (await chatCreateForUser(userId, params)) as OpenAI.Chat.ChatCompletion;

  if (completion.usage) {
    // Own-key usage is recorded for visibility, but never gates the user.
    trackTokenUsage(userId, feature, params.model, completion.usage, {
      degraded: budgetCheck.degradeToMini,
      ownKey: cfg.hasOwnKey,
      provider: cfg.provider,
    }).catch((err) => console.error("Token tracking error:", err));
  }

  return completion;
}

export async function trackedStreamingCompletion(
  userId: string,
  feature: string,
  params: OpenAI.Chat.ChatCompletionCreateParamsStreaming,
): Promise<{ stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>; trackUsage: (usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) => void }> {
  const cfg = await resolveAiConfig(userId);
  const budgetCheck = cfg.hasOwnKey
    ? { degradeToMini: false }
    : await checkTokenBudget(userId);

  if (budgetCheck.degradeToMini && params.model === "gpt-4o") {
    params = { ...params, model: "gpt-4o-mini" };
  }

  const streamParams = {
    ...params,
    stream: true as const,
    stream_options: { include_usage: true },
  };

  const stream = (await chatCreateForUser(userId, streamParams)) as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;

  const trackUsage = (usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) => {
    if (usage) {
      trackTokenUsage(userId, feature, params.model, usage, {
        streaming: true,
        degraded: budgetCheck.degradeToMini,
        ownKey: cfg.hasOwnKey,
        provider: cfg.provider,
      }).catch((err) => console.error("Token tracking error:", err));
    }
  };

  return { stream, trackUsage };
}

export async function trackedAudioTranscription(
  userId: string,
  feature: string,
  params: OpenAI.Audio.TranscriptionCreateParams,
): Promise<OpenAI.Audio.Transcription> {
  const transcription = (await transcriptionCreateForUser(userId, params)) as OpenAI.Audio.Transcription;

  trackTokenUsage(userId, feature, "whisper-1", {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  }, {
    audioTranscription: true,
  }).catch((err) => console.error("Token tracking error:", err));

  return transcription;
}

// Backwards-compatible export: modules that imported `openai` from here now
// get the provider-aware smart client (routes to Claude for BYO-key users).
export const openai = getAiClient();
