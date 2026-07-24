/**
 * MCP access-token management.
 *
 * Session-authenticated REST used by Settings → MCP Access. Separate from the
 * MCP endpoint itself: a user manages tokens while logged into the web app,
 * then uses those tokens from an external client.
 *
 * Lives in its own router rather than routes.ts — that file is already 17k
 * lines.
 */

import express from "express";
import { isAuthenticated } from "../auth";
import { apiLimiter, tokenManagementLimiter } from "../security/rate-limiters";
import {
  issueToken,
  listTokens,
  revokeToken,
  type McpScope,
} from "../services/api-tokens";
import { storage } from "../storage";
import { runWithAiContext } from "../services/ai-context";

const router = express.Router();

function currentUserId(req: any): string | undefined {
  return req.user?.dbUserId || req.user?.claims?.sub;
}

/** List the caller's active tokens. Never returns a secret. */
router.get("/tokens", isAuthenticated, async (req: any, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    res.json({ tokens: await listTokens(userId) });
  } catch (error: any) {
    console.error("[mcp-tokens] list failed:", error);
    res.status(500).json({ error: "Failed to list tokens" });
  }
});

/**
 * Mint a token. The plaintext is in this response and nowhere else — it is
 * hashed before storage and cannot be recovered afterwards.
 */
router.post("/tokens", isAuthenticated, tokenManagementLimiter, async (req: any, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "A token name is required" });

    // Basic tier is read-only. The scope column and checks are already in
    // place, so enabling write later is a one-line change here — not a
    // migration.
    const scopes: McpScope[] = ["read"];

    // Optional expiry. Clamped rather than trusted: a caller could otherwise
    // pass a value large enough to overflow the Date arithmetic in issueToken
    // and silently produce a token that never expires.
    const raw = req.body?.expiresInDays;
    const expiresInDays =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.min(3650, Math.floor(raw))
        : undefined;

    const { token, record } = await issueToken({ userId, name, scopes, expiresInDays });

    res.status(201).json({
      token,
      record,
      warning: "This token is shown only once. Copy it now — it cannot be retrieved later.",
    });
  } catch (error: any) {
    console.error("[mcp-tokens] create failed:", error);
    res.status(400).json({ error: error?.message || "Failed to create token" });
  }
});

/** Revoke a token. Scoped by userId, so ids from other users simply 404. */
router.delete("/tokens/:id", isAuthenticated, tokenManagementLimiter, async (req: any, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid token id" });

    const revoked = await revokeToken(userId, id);
    if (!revoked) return res.status(404).json({ error: "Token not found" });

    res.json({ revoked: true });
  } catch (error: any) {
    console.error("[mcp-tokens] revoke failed:", error);
    res.status(500).json({ error: "Failed to revoke token" });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Readiness — what this user actually has available to expose.
// ─────────────────────────────────────────────────────────────────────────
//
// Powers the Connect page's "ready to share" panel. Two jobs:
//   1. Make the abstract concrete — "3 themes with 8 traced quotes" beats
//      "themes are supported".
//   2. Catch the empty-account case, so nobody sets up a connection to
//      nothing and concludes the integration is broken.
//
// Also returns a couple of real names so the page can generate example
// prompts from the user's own data rather than generic placeholders.
router.get("/readiness", isAuthenticated, apiLimiter, async (req: any, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [zoom, gmeet, teams, conversations, themes, mentions, tiers, intel] =
      await Promise.all([
        storage.getZoomMeetings(userId).catch(() => []),
        storage.getGoogleMeetMeetings(userId).catch(() => []),
        storage.getTeamsMeetings(userId).catch(() => []),
        storage.getConversations(userId).catch(() => []),
        storage.getThemes(userId).catch(() => []),
        storage.getThemeMentionsForUser(userId).catch(() => []),
        storage.getCustomerTiers(userId).catch(() => []),
        (storage as any).getCompletedIntelligenceDocuments?.(userId)?.catch(
          () => [],
        ) ?? Promise.resolve([]),
      ]);

    const allMeetings = [...zoom, ...gmeet, ...teams];
    const withTranscript = allMeetings.filter(
      (m: any) => typeof m.transcript === "string" && m.transcript.trim(),
    );

    const activeThemes = (themes as any[]).filter(
      (t) => (t.status ?? "active") === "active",
    );

    // Highest weighted theme + the highest-weight company that actually
    // mentioned it — the raw material for a personalised example prompt.
    const topTheme = [...activeThemes].sort(
      (a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0),
    )[0];

    let topCompany: string | null = null;
    if (topTheme) {
      const forTheme = (mentions as any[])
        .filter((m) => m.themeId === topTheme.id && m.company)
        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
      topCompany = forTheme[0]?.company ?? null;
    }

    const topMeeting = [...withTranscript].sort((a: any, b: any) => {
      const at = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
      return bt - at;
    })[0];

    res.json({
      counts: {
        meetings: allMeetings.length,
        meetingsWithTranscript: withTranscript.length,
        conversations: (conversations as any[]).length,
        themes: activeThemes.length,
        tracedQuotes: (mentions as any[]).length,
        intelligenceDocuments: (intel as any[]).length,
        customerTiers: (tiers as any[]).length,
      },
      hasAnything:
        allMeetings.length > 0 ||
        (conversations as any[]).length > 0 ||
        activeThemes.length > 0,
      highlights: {
        topThemeTitle: topTheme?.title ?? null,
        topCompany,
        latestMeetingSubject: (topMeeting as any)?.subject ?? null,
      },
    });
  } catch (error: any) {
    console.error("[mcp-tokens] readiness failed:", error);
    res.status(500).json({ error: "Failed to load readiness" });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Live preview — run a real tool and return exactly what an AI client sees.
// ─────────────────────────────────────────────────────────────────────────
//
// Deliberately goes through the SAME McpServer the HTTP endpoint builds,
// over an in-memory transport, rather than calling storage directly. If this
// returns data, the tool layer genuinely works — so any failure the user then
// hits in Claude Desktop is client-side config, not the server. A preview
// that took a shortcut would not prove that.
//
// Authenticated by SESSION, not by an MCP token: the whole point is to let
// someone see what they'd get before they create a credential.
const PREVIEWABLE_TOOLS = new Set([
  "list_meetings",
  "list_themes",
  "get_theme",
  "list_conversations",
  "list_intelligence_documents",
  "list_customer_tiers",
]);

router.post("/preview", isAuthenticated, apiLimiter, async (req: any, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const tool = typeof req.body?.tool === "string" ? req.body.tool : "";
    if (!PREVIEWABLE_TOOLS.has(tool)) {
      return res.status(400).json({
        error: `Tool '${tool}' is not available for preview.`,
        allowed: Array.from(PREVIEWABLE_TOOLS),
      });
    }

    const args =
      req.body?.arguments && typeof req.body.arguments === "object"
        ? req.body.arguments
        : {};

    const { buildServer } = await import("../mcp");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import(
      "@modelcontextprotocol/sdk/inMemory.js"
    );

    // Synthetic principal: this session's user, read scope only. tokenId 0
    // marks it as not backed by a real token, so nothing tries to touch one.
    const server = buildServer({ userId, tokenId: 0, scopes: ["read"] });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "requisor-connect-preview", version: "1.0.0" });

    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      const result: any = await runWithAiContext({ userId }, () =>
        client.callTool({ name: tool, arguments: args }),
      );

      const text = result?.content?.[0]?.text ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      res.json({ tool, isError: result?.isError ?? false, result: parsed });
    } finally {
      await client.close().catch(() => {});
      await server.close().catch(() => {});
    }
  } catch (error: any) {
    console.error("[mcp-tokens] preview failed:", error);
    res.status(500).json({ error: "Preview failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Activity — what a connected AI actually read.
// ─────────────────────────────────────────────────────────────────────────
//
// The transparency counterpart to handing out a credential. Tool names and
// timestamps only; arguments and results are never recorded.
router.get("/activity", isAuthenticated, apiLimiter, async (req: any, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { db } = await import("../db");
    const { mcpToolCalls } = await import("@shared/schema");
    const { eq, desc, sql } = await import("drizzle-orm");

    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit ?? "15"), 10) || 15),
    );

    const [recent, totals] = await Promise.all([
      db
        .select()
        .from(mcpToolCalls)
        .where(eq(mcpToolCalls.userId, userId))
        .orderBy(desc(mcpToolCalls.createdAt))
        .limit(limit),
      db
        .select({
          toolName: mcpToolCalls.toolName,
          count: sql<number>`count(*)::int`,
        })
        .from(mcpToolCalls)
        .where(eq(mcpToolCalls.userId, userId))
        .groupBy(mcpToolCalls.toolName)
        .orderBy(sql`count(*) desc`)
        .limit(6),
    ]);

    res.json({
      recent: recent.map((r) => ({
        id: r.id,
        toolName: r.toolName,
        tokenName: r.tokenName,
        createdAt: r.createdAt,
      })),
      topTools: totals,
      total: recent.length,
    });
  } catch (error: any) {
    console.error("[mcp-tokens] activity failed:", error);
    res.status(500).json({ error: "Failed to load activity" });
  }
});

export default router;
