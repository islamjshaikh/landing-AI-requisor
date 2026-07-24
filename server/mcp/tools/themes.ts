/**
 * MCP tools — Theme Finder.
 *
 * Themes are clusters of what customers actually said, mined from every
 * meeting transcript, imported conversation, evidence item and processed
 * intelligence document the user has.
 *
 * THE GUARANTEE WORTH PRESERVING
 * ──────────────────────────────
 * From server/services/theme-analyzer.ts:
 *
 *   "quotes and speakers/timestamps come from OUR parsing of the stored text.
 *    The AI never invents them; it only clusters and names the themes."
 *
 * Every mention is therefore a real, verbatim line from a real transcript.
 * That is the property that makes themes trustworthy input for an agent — so
 * `get_theme_source_transcript` ships alongside the theme readers, letting a
 * model verify any quote in its original context rather than taking it on
 * faith.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { storage } from "../../storage";
import { runWithAiContext } from "../../services/ai-context";
import { checkTokenBudget } from "../../services/token-tracker";
import { McpToolError, assertThemeAccess, paginate, windowText } from "../guards";
import { ok, toolHandler, type McpToolContext } from "../runtime";

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Mirrors the `assembleTheme` closure in routes.ts:16668 — breakdowns by
 * source and customer tier, distinct companies, average AI confidence.
 * Reimplemented here rather than refactored out of the 17k-line routes file.
 *
 * Drops `embedding`: it is a large internal vector with no meaning to a
 * consumer, and including it would waste thousands of tokens per call.
 */
function assembleTheme(theme: any, mentions: any[]) {
  const sourceBreakdown: Record<string, number> = {};
  const tierBreakdown: Record<string, number> = {};
  const companies = new Set<string>();
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const m of mentions) {
    sourceBreakdown[m.sourceType] = (sourceBreakdown[m.sourceType] || 0) + 1;
    const tier = m.customerTier || "standard";
    tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1;
    if (m.company) companies.add(m.company);
    if (typeof m.confidence === "number") {
      confidenceSum += m.confidence;
      confidenceCount++;
    }
  }

  const { embedding, ...rest } = theme || {};
  return {
    ...rest,
    lastSeenAt: toIso(rest.lastSeenAt),
    createdAt: toIso(rest.createdAt),
    updatedAt: toIso(rest.updatedAt),
    sourceBreakdown,
    tierBreakdown,
    companies: Array.from(companies),
    avgConfidence: confidenceCount ? confidenceSum / confidenceCount : null,
  };
}

function shapeMention(m: any) {
  return {
    id: m.id,
    quote: m.quote,
    speaker: m.speaker,
    company: m.company,
    customerTier: m.customerTier,
    weight: m.weight,
    confidence: m.confidence,
    sourceType: m.sourceType,
    sourceId: m.sourceId,
    sourceLabel: m.sourceLabel,
    timestampLabel: m.timestampLabel,
    recordingUrl: m.recordingUrl,
    deepLink: m.deepLink,
  };
}

export function registerThemeTools(server: McpServer, ctx: McpToolContext): void {
  // ───────────────────────────────────────────────────────────────────────
  // list_themes   🔶 AI-invoking when `query` is supplied
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "list_themes",
    {
      title: "List customer themes",
      description:
        "List recurring themes mined from meetings, transcripts and evidence — what " +
        "customers keep raising. Each theme carries a mentionCount, a " +
        "distinctSourceCount, and a weightedScore that weights mentions by customer " +
        "tier (enterprise accounts count for more). Sort by weightedScore to find what " +
        "matters commercially, by mentionCount to find what is simply most frequent. " +
        "Supplying `query` ranks semantically, falling back to keyword matching.",
      inputSchema: {
        query: z.string().optional().describe("Natural-language search, e.g. 'onboarding friction'."),
        minMentions: z.number().optional().describe("Only themes with at least this many mentions."),
        category: z.string().optional().describe("Filter by category bucket."),
        status: z
          .enum(["active", "merged"])
          .optional()
          .describe("Default 'active'. Merged themes were folded into another."),
        sortBy: z
          .enum(["weightedScore", "mentionCount", "distinctSourceCount", "lastSeenAt"])
          .optional()
          .describe("Default weightedScore."),
        limit: z.number().optional().describe("Page size, 1-100. Default 25."),
        offset: z.number().optional().describe("Rows to skip."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const userId = ctx.principal.userId;
      const rawQ = args.query?.trim() || "";

      const allMentions = await storage.getThemeMentionsForUser(userId);
      const byTheme = new Map<number, any[]>();
      for (const m of allMentions) {
        if (!byTheme.has(m.themeId)) byTheme.set(m.themeId, []);
        byTheme.get(m.themeId)!.push(m);
      }

      let themes: any[] = await storage.getThemes(userId);
      let searchMode: "semantic" | "keyword" | "none" = "none";

      if (rawQ) {
        searchMode = "keyword";
        // Embedding the query costs tokens. A user at their cap still gets
        // keyword results rather than a refusal — keyword search is free.
        const budget = await checkTokenBudget(userId);
        if (budget.allowed) {
          try {
            const { memoryManager } = await import("../../services/memory-manager");
            const queryEmbedding = await runWithAiContext({ userId }, () =>
              memoryManager.getEmbedding(rawQ),
            );
            if (queryEmbedding && (storage as any).searchThemesBySimilarity) {
              const hits = await (storage as any).searchThemesBySimilarity(userId, queryEmbedding);
              if (hits && hits.length) {
                themes = hits;
                searchMode = "semantic";
              }
            }
          } catch (err: any) {
            console.error("[mcp] semantic theme search failed:", err?.message || err);
          }
        }

        if (searchMode === "keyword") {
          // Same tokenising fallback as GET /api/themes: match ANY significant
          // term so "latency issues" still finds a theme mentioning "latency".
          const STOP = new Set([
            "issue", "issues", "problem", "problems", "concern", "concerns",
            "need", "needs", "the", "a", "an", "and", "or", "of", "in", "on",
            "for", "to", "with", "about", "is", "are", "our", "we",
          ]);
          const q = rawQ.toLowerCase();
          const terms = q.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
          const effective = terms.length ? terms : [q];
          const hasTerm = (text: string | null | undefined) =>
            !!text && effective.some((w) => text.toLowerCase().includes(w));

          themes = themes.filter((t) => {
            if (hasTerm(t.title) || hasTerm(t.description) || hasTerm(t.category)) return true;
            return (byTheme.get(t.id) || []).some(
              (m: any) => hasTerm(m.quote) || hasTerm(m.company) || hasTerm(m.speaker),
            );
          });
        }
      }

      const wantStatus = args.status ?? "active";
      let assembled = themes
        .filter((t) => (t.status ?? "active") === wantStatus)
        .map((t) => assembleTheme(t, byTheme.get(t.id) || []));

      if (typeof args.minMentions === "number") {
        assembled = assembled.filter((t: any) => (t.mentionCount ?? 0) >= args.minMentions!);
      }
      if (args.category) {
        const want = args.category.toLowerCase();
        assembled = assembled.filter((t: any) => (t.category || "").toLowerCase() === want);
      }

      const sortBy = args.sortBy ?? "weightedScore";
      assembled.sort((a: any, b: any) => {
        if (sortBy === "lastSeenAt") {
          return (b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0) -
            (a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0);
        }
        return (b[sortBy] ?? 0) - (a[sortBy] ?? 0);
      });

      const page = paginate(assembled, args.offset, args.limit);
      return ok({ ...page, searchMode });
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // get_theme
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_theme",
    {
      title: "Get theme detail",
      description:
        "Fetch one theme with its aggregate breakdowns — by source type, by customer " +
        "tier, distinct companies, average AI confidence — plus a sample of its traced " +
        "mentions. A busy theme can have hundreds of mentions, so only the first few " +
        "are included here; use get_theme_mentions to page through them all.",
      inputSchema: {
        themeId: z.number().describe("Theme id, from list_themes."),
        sampleMentions: z
          .number()
          .optional()
          .describe("How many example mentions to include, 0-100. Default 10."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const theme = await assertThemeAccess(ctx.principal.userId, args.themeId);
      const mentions = await storage.getThemeMentions(args.themeId);

      const sampleSize =
        typeof args.sampleMentions === "number"
          ? Math.max(0, Math.min(100, Math.floor(args.sampleMentions)))
          : 10;

      return ok({
        ...assembleTheme(theme, mentions),
        totalMentions: mentions.length,
        sampleMentions: mentions.slice(0, sampleSize).map(shapeMention),
      });
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // get_theme_mentions
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_theme_mentions",
    {
      title: "Get traced quotes for a theme",
      description:
        "Page through the verbatim quotes behind a theme. Each mention carries the " +
        "speaker, company, customer tier, the source it came from, and — where a " +
        "recording exists — a deep link to the exact timestamp. These quotes are " +
        "extracted verbatim from stored transcripts, not generated, so they can be " +
        "quoted directly and verified with get_theme_source_transcript.",
      inputSchema: {
        themeId: z.number().describe("Theme id."),
        sourceType: z
          .string()
          .optional()
          .describe("Filter by origin, e.g. 'zoom', 'teams', 'google_meet', 'evidence'."),
        company: z.string().optional().describe("Filter by company name."),
        customerTier: z
          .enum(["enterprise", "mid_market", "smb", "standard"])
          .optional()
          .describe("Filter by customer tier."),
        minConfidence: z.number().optional().describe("Only mentions at or above this 0-1 score."),
        limit: z.number().optional().describe("Page size, 1-100. Default 25."),
        offset: z.number().optional().describe("Rows to skip."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      await assertThemeAccess(ctx.principal.userId, args.themeId);
      let mentions: any[] = await storage.getThemeMentions(args.themeId);

      if (args.sourceType) {
        mentions = mentions.filter((m) => m.sourceType === args.sourceType);
      }
      if (args.company) {
        const want = args.company.toLowerCase();
        mentions = mentions.filter((m) => (m.company || "").toLowerCase().includes(want));
      }
      if (args.customerTier) {
        mentions = mentions.filter((m) => (m.customerTier || "standard") === args.customerTier);
      }
      if (typeof args.minConfidence === "number") {
        mentions = mentions.filter(
          (m) => typeof m.confidence === "number" && m.confidence >= args.minConfidence!,
        );
      }

      const page = paginate(mentions, args.offset, args.limit);
      return ok({ ...page, items: page.items.map(shapeMention) });
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // get_theme_source_transcript
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_theme_source_transcript",
    {
      title: "Open the source behind a quote",
      description:
        "Resolve the original transcript a theme mention came from, so a quote can be " +
        "read in context and verified. Pass the sourceType and sourceId from any " +
        "mention. Returns a bounded window of the source text; pass the quote to have " +
        "the window centred on where it appears.",
      inputSchema: {
        sourceType: z
          .string()
          .describe("From the mention: 'zoom', 'google_meet', 'teams', 'conversation', 'evidence'."),
        sourceId: z.number().describe("From the mention."),
        quote: z.string().optional().describe("Centre the window on this quote if it is found."),
        offset: z.number().optional().describe("Character offset. Ignored when `quote` matches."),
        limit: z.number().optional().describe("Max characters, up to 20000."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const userId = ctx.principal.userId;
      let text: string | null = null;
      let label = `${args.sourceType} #${args.sourceId}`;

      // Every branch below re-checks ownership: these getters take a bare id.
      switch (args.sourceType) {
        case "zoom": {
          const row = await storage.getZoomMeeting(args.sourceId);
          if (row && String(row.userId) === String(userId)) {
            text = row.transcript ?? null;
            label = row.subject || label;
          }
          break;
        }
        case "google_meet": {
          const row = await storage.getGoogleMeetMeeting(args.sourceId);
          if (row && String(row.userId) === String(userId)) {
            text = row.transcript ?? null;
            label = row.subject || label;
          }
          break;
        }
        case "teams": {
          const row = await storage.getTeamsMeeting(args.sourceId);
          if (row && String(row.userId) === String(userId)) {
            text = row.transcript ?? null;
            label = row.subject || label;
          }
          break;
        }
        case "conversation":
        case "manual":
        case "transcript":
        case "slack": {
          const row = await storage.getConversation(args.sourceId);
          if (row && String(row.userId) === String(userId)) {
            text = row.content ?? null;
            label = row.title || label;
          }
          break;
        }
        case "evidence": {
          const items = await storage.getEvidenceItems(userId);
          const row = items.find((e: any) => e.id === args.sourceId);
          if (row) {
            text = (row as any).content ?? null;
            label = (row as any).title || label;
          }
          break;
        }
        default:
          throw new McpToolError(
            `Unsupported source type '${args.sourceType}'. Expected one of: ` +
              "zoom, google_meet, teams, conversation, evidence.",
          );
      }

      if (!text) {
        throw new McpToolError(
          `No readable source found for ${args.sourceType} #${args.sourceId}.`,
        );
      }

      // Centre the window on the quote when we can find it, so the model sees
      // what came before and after rather than an arbitrary slice.
      let offset = args.offset;
      let quoteFound = false;
      if (args.quote) {
        const idx = text.indexOf(args.quote.trim());
        if (idx >= 0) {
          quoteFound = true;
          offset = Math.max(0, idx - 2000);
        }
      }

      return ok({
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        sourceLabel: label,
        quoteFound: args.quote ? quoteFound : undefined,
        ...windowText(text, offset, args.limit),
      });
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // list_customer_tiers
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "list_customer_tiers",
    {
      title: "List customer tiers and weights",
      description:
        "List the company-to-tier mapping and the weight each tier contributes to a " +
        "theme's weightedScore. Fetch this before interpreting weightedScore — without " +
        "it, that number has no meaning. Companies absent from this list default to " +
        "the 'standard' tier with weight 1.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async () => {
      const tiers = await storage.getCustomerTiers(ctx.principal.userId);
      return ok({
        tiers: tiers.map((t: any) => ({
          company: t.company,
          tier: t.tier,
          weight: t.weight,
        })),
        note:
          "Companies not listed here are treated as tier 'standard' with weight 1. " +
          "weightedScore = sum of each mention's tier weight.",
      });
    }),
  );
}
