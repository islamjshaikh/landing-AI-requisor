/**
 * Per-request AI context, propagated with AsyncLocalStorage.
 *
 * The app has 30+ modules that instantiate a shared OpenAI client at module
 * load and call `.chat.completions.create(...)` without threading a userId
 * through every call site. To route AI through a user's own provider (BYO
 * Claude key) without rewriting every call, we carry the current request's
 * userId in async-local storage. The smart AI client (see ai-provider.ts)
 * reads it to resolve which provider/key to use.
 */
import { AsyncLocalStorage } from "async_hooks";

interface AiRequestContext {
  userId?: string;
}

const storage = new AsyncLocalStorage<AiRequestContext>();

/** Run `fn` with the given AI request context bound to async-local storage. */
export function runWithAiContext<T>(ctx: AiRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** The userId of the current request, if one is bound. */
export function getContextUserId(): string | undefined {
  return storage.getStore()?.userId;
}
