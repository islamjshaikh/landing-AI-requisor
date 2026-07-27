/**
 * Requisor MCP server — Phase A (basic tier: read-only).
 *
 * Exposes Meetings and Theme Finder to external MCP clients (Claude Desktop,
 * Claude Code, Cursor) over Streamable HTTP.
 *
 * ── Transport: stateless ────────────────────────────────────────────────
 * A fresh McpServer + transport is built per request and discarded after.
 * That costs a little construction time but buys three things that matter for
 * a multi-tenant hosted app:
 *
 *   1. No cross-request server state, so one user's context can never leak
 *      into another's — the userId is baked into the instance at build time.
 *   2. No sticky sessions, so it scales horizontally with no coordination.
 *   3. Nothing to clean up when a client disconnects mid-stream.
 *
 * ── Mount path: /api/mcp, not /mcp ──────────────────────────────────────
 * The production SPA catch-all in server/index.ts only excludes /api,
 * /uploads and /media. A bare /mcp would be swallowed by it and answered with
 * index.html. Mounting under /api also inherits the existing JSON body parser
 * and no-cache headers.
 */

import { Router, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { runWithAiContext } from "../services/ai-context";
import { verifyToken, touchToken, type McpPrincipal } from "../services/api-tokens";
import { mcpLimiter } from "../security/rate-limiters";
import type { McpToolContext } from "./runtime";
import { registerMeetingTools } from "./tools/meetings";
import { registerIntelligenceTools } from "./tools/intelligence";
import { registerThemeTools } from "./tools/themes";

const SERVER_NAME = "requisor";
const SERVER_VERSION = "1.0.0";

/**
 * Build a server instance bound to one authenticated principal.
 *
 * Binding at construction — rather than passing userId through each call — is
 * what makes the stateless design safe: a tool physically cannot see another
 * user's id, because the closure only ever captured one.
 */
export function buildServer(principal: McpPrincipal): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Requisor is a product-discovery and project-management platform. This server " +
        "exposes the user's meetings and their customer themes.\n\n" +
        "Meetings: Zoom, Google Meet and Teams meetings with transcripts, plus manually " +
        "imported notes and audio transcriptions. Processed transcripts also have a " +
        "structured 'intelligence document' holding decisions, action items with owners " +
        "and deadlines, and risks — prefer get_intelligence_document over reading a raw " +
        "transcript when one exists; it is far shorter and already structured.\n\n" +
        "Themes: recurring topics mined from all of that content. Every theme mention is " +
        "a verbatim quote extracted from a stored transcript — never generated — and can " +
        "be verified in context with get_theme_source_transcript. Quote them directly.\n\n" +
        "weightedScore weights mentions by customer tier; call list_customer_tiers before " +
        "interpreting it.\n\n" +
        "This token is read-only. Nothing here modifies data.",
    },
  );

  const ctx: McpToolContext = { principal };
  registerMeetingTools(server, ctx);
  registerIntelligenceTools(server, ctx);
  registerThemeTools(server, ctx);

  return server;
}

function bearerFrom(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, ...rest] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return undefined;
  const value = rest.join(" ").trim();
  return value || undefined;
}

/**
 * Record what an AI client actually read, for the Connect page's activity feed.
 *
 * Done here rather than inside each tool because the router sees every request
 * in one place — no per-tool wiring to forget, and it stays correct as tools
 * are added.
 *
 * Only `tools/call` is logged. Protocol chatter (initialize, tools/list) fires
 * on every reconnect and would bury the entries that matter. Arguments and
 * results are never stored.
 */
function recordToolCall(principal: McpPrincipal, body: any): void {
  try {
    if (!body || body.method !== "tools/call") return;
    const toolName = body?.params?.name;
    if (typeof toolName !== "string" || !toolName) return;

    void (async () => {
      try {
        const { db } = await import("../db");
        const { mcpToolCalls, userApiTokens } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        // Snapshot the label so history stays readable after a revoke.
        let tokenName: string | null = null;
        if (principal.tokenId) {
          const rows = await db
            .select({ name: userApiTokens.name })
            .from(userApiTokens)
            .where(eq(userApiTokens.id, principal.tokenId))
            .limit(1);
          tokenName = rows[0]?.name ?? null;
        }

        await db.insert(mcpToolCalls).values({
          userId: principal.userId,
          tokenId: principal.tokenId || null,
          tokenName,
          toolName,
          method: "tools/call",
        });
      } catch (err: any) {
        // Audit logging must never break the request it describes.
        console.warn("[mcp] tool-call log failed:", err?.message || err);
      }
    })();
  } catch {
    /* ignore */
  }
}

/** JSON-RPC-shaped error, so a compliant client renders it rather than choking. */
function rpcError(res: Response, status: number, message: string): void {
  res.status(status).json({
    jsonrpc: "2.0",
    error: { code: status === 401 ? -32001 : -32603, message },
    id: null,
  });
}

export function createMcpRouter(): Router {
  const router = Router();

  router.post("/", mcpLimiter, async (req: Request, res: Response) => {
    const principal = await verifyToken(bearerFrom(req));
    if (!principal) {
      // Point spec-aware clients at our protected-resource metadata (RFC 9728)
      // so they can start the OAuth flow. The resource_metadata parameter is
      // what triggers Claude/Cursor to open the consent window rather than
      // just failing. Manual-token users are unaffected — they send a token
      // and never see this.
      const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const base = `${proto}://${host}`;
      res.setHeader(
        "WWW-Authenticate",
        `Bearer realm="requisor-mcp", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      );
      return rpcError(
        res,
        401,
        "Authentication required. Connect via OAuth, or send a bearer token " +
          "generated in Requisor under Connect.",
      );
    }

    touchToken(principal.tokenId); // fire-and-forget
    recordToolCall(principal, req.body); // fire-and-forget

    const server = buildServer(principal);
    const transport = new StreamableHTTPServerTransport({
      // undefined => stateless: no session id issued, no session state kept.
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      // Every tool runs inside this context. Binding it at the request
      // boundary — rather than around individual AI calls — means any tool
      // that transitively reaches an AI service inherits the right userId
      // automatically. Without it, an own-key (BYOK) user's embedding call
      // would silently bill the platform key.
      await runWithAiContext({ userId: principal.userId }, () =>
        transport.handleRequest(req, res, req.body),
      );
    } catch (err: any) {
      console.error("[mcp] request failed:", err?.stack || err?.message || err);
      if (!res.headersSent) {
        rpcError(res, 500, "Internal server error");
      }
    }
  });

  // Streamable HTTP reserves GET for server-initiated SSE streams and DELETE
  // for session teardown. Neither applies in stateless mode — answer clearly
  // rather than letting the SPA catch-all return HTML.
  const notAllowed = (_req: Request, res: Response) =>
    rpcError(res, 405, "This MCP endpoint is stateless; use POST.");
  router.get("/", notAllowed);
  router.delete("/", notAllowed);

  return router;
}
