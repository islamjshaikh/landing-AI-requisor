/**
 * Shared plumbing for MCP tool handlers: result shaping and error boundaries.
 */

import type { McpPrincipal } from "../services/api-tokens";
import { McpToolError } from "./guards";

/** Per-request context handed to every tool registration. */
export interface McpToolContext {
  principal: McpPrincipal;
}

/** MCP content-block result shape. */
export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Serialise a successful payload. JSON rather than prose — models parse
 * structured output far more reliably, and it keeps the token cost honest.
 */
export function ok(payload: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

/**
 * Return a failure the model can read and act on.
 *
 * Deliberately NOT a thrown protocol error: a protocol error surfaces to the
 * user as a broken connection, whereas an `isError` result lets the model say
 * "that meeting doesn't exist, did you mean…" and carry on.
 */
export function fail(message: string): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

/**
 * Wrap a tool body with the standard error boundary.
 *
 * - McpToolError  → its message is intended for the model, pass it through.
 * - anything else → log server-side, return a generic message. Internal
 *   errors must never leak stack traces or SQL to an external MCP client,
 *   matching the global handler's posture in server/index.ts.
 */
export function toolHandler<A>(
  fn: (args: A) => Promise<McpToolResult>,
): (args: A) => Promise<McpToolResult> {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (err: any) {
      if (err instanceof McpToolError) {
        return fail(err.message);
      }
      console.error("[mcp] tool error:", err?.stack || err?.message || err);
      return fail("The request could not be completed. Please try again.");
    }
  };
}
