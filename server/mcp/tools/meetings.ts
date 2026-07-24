/**
 * MCP tools — Meetings.
 *
 * Read-only surface over Zoom / Google Meet / Teams meetings, manually
 * imported conversations, Whisper transcriptions, and the meeting-intelligence
 * (MOM) extractor output.
 *
 * Two of these are genuinely new capability rather than a wrapper:
 *
 *   list_meetings           — no server endpoint exists for this. The
 *                             Meetings page merges the three provider queries
 *                             client-side in its "All" tab.
 *   get_meeting_transcript  — every existing path returns the whole
 *                             transcript column at once.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { storage } from "../../storage";
import { runWithAiContext } from "../../services/ai-context";
import { checkTokenBudget } from "../../services/token-tracker";
import {
  MEETING_SOURCES,
  assertMeetingAccess,
  assertMeetingSource,
  clampLimit,
  clampOffset,
  paginate,
  windowText,
} from "../guards";
import { ok, toolHandler, type McpToolContext } from "../runtime";

/** Source types the meetings search indexes over. Mirrors routes.ts:15712. */
const MEETING_SOURCE_TYPES = ["zoom", "google_meet", "teams", "conversation", "intelligence"];

/** Normalised shape returned by list_meetings, whatever the provider. */
interface UnifiedMeeting {
  source: string;
  id: number;
  subject: string;
  startTime: string | null;
  endTime: string | null;
  status: string | null;
  attendees: string[];
  hasTranscript: boolean;
  transcriptChars: number;
  joinUrl: string | null;
  recordingUrl: string | null;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function unify(source: string, row: any): UnifiedMeeting {
  const transcript = typeof row.transcript === "string" ? row.transcript : "";
  return {
    source,
    id: row.id,
    subject: row.subject ?? `${source} meeting #${row.id}`,
    startTime: toIso(row.startTime),
    endTime: toIso(row.endTime),
    status: row.status ?? null,
    attendees: Array.isArray(row.attendees) ? row.attendees : [],
    hasTranscript: transcript.trim().length > 0,
    transcriptChars: transcript.length,
    joinUrl: row.joinUrl ?? row.meetLink ?? null,
    recordingUrl: row.recordingUrl ?? null,
  };
}

export function registerMeetingTools(server: McpServer, ctx: McpToolContext): void {
  // ───────────────────────────────────────────────────────────────────────
  // list_meetings
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "list_meetings",
    {
      title: "List meetings",
      description:
        "List the user's meetings across Zoom, Google Meet and Microsoft Teams in one " +
        "chronological feed. Use this to find a meeting before fetching its transcript " +
        "or intelligence summary. Does NOT include manually imported notes or audio " +
        "transcriptions — use list_conversations for those.",
      inputSchema: {
        source: z
          .enum(MEETING_SOURCES)
          .optional()
          .describe("Restrict to one provider. Omit for all three."),
        hasTranscript: z
          .boolean()
          .optional()
          .describe("Only return meetings that already have a transcript stored."),
        dateFrom: z.string().optional().describe("ISO date; only meetings starting on or after."),
        dateTo: z.string().optional().describe("ISO date; only meetings starting on or before."),
        limit: z.number().optional().describe("Page size, 1-100. Default 25."),
        offset: z.number().optional().describe("Rows to skip. Use nextOffset from a prior call."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const userId = ctx.principal.userId;

      const wanted = args.source ? [args.source] : [...MEETING_SOURCES];
      const collected: UnifiedMeeting[] = [];

      // Each getter is already userId-scoped, so no per-row guard is needed
      // on the list path — only on the by-id path.
      await Promise.all(
        wanted.map(async (src) => {
          let rows: any[] = [];
          if (src === "zoom") rows = await storage.getZoomMeetings(userId).catch(() => []);
          else if (src === "google_meet")
            rows = await storage.getGoogleMeetMeetings(userId).catch(() => []);
          else if (src === "teams") rows = await storage.getTeamsMeetings(userId).catch(() => []);
          for (const r of rows) collected.push(unify(src, r));
        }),
      );

      let filtered = collected;
      if (args.hasTranscript === true) filtered = filtered.filter((m) => m.hasTranscript);
      if (args.hasTranscript === false) filtered = filtered.filter((m) => !m.hasTranscript);

      const from = args.dateFrom ? Date.parse(args.dateFrom) : NaN;
      const to = args.dateTo ? Date.parse(args.dateTo) : NaN;
      if (!Number.isNaN(from)) {
        filtered = filtered.filter((m) => m.startTime && Date.parse(m.startTime) >= from);
      }
      if (!Number.isNaN(to)) {
        filtered = filtered.filter((m) => m.startTime && Date.parse(m.startTime) <= to);
      }

      filtered.sort((a, b) => {
        const at = a.startTime ? Date.parse(a.startTime) : 0;
        const bt = b.startTime ? Date.parse(b.startTime) : 0;
        return bt - at; // newest first
      });

      return ok(paginate(filtered, args.offset, args.limit));
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // get_meeting
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_meeting",
    {
      title: "Get meeting details",
      description:
        "Fetch one meeting's metadata: subject, times, attendees, status, join and " +
        "recording links, and whether a transcript is stored. Does not return the " +
        "transcript text — use get_meeting_transcript for that.",
      inputSchema: {
        source: z.enum(MEETING_SOURCES).describe("Which provider the meeting belongs to."),
        meetingId: z.number().describe("Requisor's numeric meeting id, from list_meetings."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const source = assertMeetingSource(args.source);
      const row = await assertMeetingAccess(ctx.principal.userId, source, args.meetingId);
      return ok(unify(source, row));
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // get_meeting_transcript
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_meeting_transcript",
    {
      title: "Get meeting transcript",
      description:
        "Read the stored transcript for a meeting, in bounded windows. Transcripts are " +
        "often very long, so this returns at most 20,000 characters per call along with " +
        "`hasMore` and `nextOffset` — call again with that offset to continue. " +
        "If an intelligence summary exists for this meeting, prefer " +
        "get_intelligence_document: it is far shorter and already structured.",
      inputSchema: {
        source: z.enum(MEETING_SOURCES).describe("Which provider the meeting belongs to."),
        meetingId: z.number().describe("Requisor's numeric meeting id."),
        offset: z.number().optional().describe("Character offset to start from. Default 0."),
        limit: z.number().optional().describe("Max characters to return, up to 20000."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const source = assertMeetingSource(args.source);
      const row = await assertMeetingAccess(ctx.principal.userId, source, args.meetingId);

      if (!row.transcript || !String(row.transcript).trim()) {
        return ok({
          source,
          meetingId: args.meetingId,
          subject: row.subject,
          transcriptAvailable: false,
          message:
            "No transcript is stored for this meeting. It may not have been fetched " +
            "from the provider yet, or the meeting may not have been recorded.",
        });
      }

      const win = windowText(row.transcript, args.offset, args.limit);
      return ok({
        source,
        meetingId: args.meetingId,
        subject: row.subject,
        transcriptAvailable: true,
        ...win,
      });
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // list_conversations
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "list_conversations",
    {
      title: "List conversations and imported transcripts",
      description:
        "List manually imported meeting notes, pasted transcripts, chat exports and " +
        "audio transcriptions. These are the records that do NOT appear in " +
        "list_meetings. Content is truncated to a preview; ask for a specific id to " +
        "read it in full.",
      inputSchema: {
        source: z
          .string()
          .optional()
          .describe("Filter by origin, e.g. 'manual', 'transcription', 'zoom', 'slack'."),
        limit: z.number().optional().describe("Page size, 1-100. Default 25."),
        offset: z.number().optional().describe("Rows to skip."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const rows = await storage.getConversations(ctx.principal.userId);
      const filtered = args.source ? rows.filter((r: any) => r.source === args.source) : rows;

      const shaped = filtered.map((r: any) => ({
        id: r.id,
        title: r.title,
        source: r.source,
        meetingDate: toIso(r.meetingDate),
        participants: Array.isArray(r.participants) ? r.participants : [],
        tags: Array.isArray(r.tags) ? r.tags : [],
        summary: r.summary ?? null,
        contentChars: typeof r.content === "string" ? r.content.length : 0,
        contentPreview:
          typeof r.content === "string" ? r.content.slice(0, 500) : "",
        createdAt: toIso(r.createdAt),
      }));

      return ok(paginate(shaped, args.offset, args.limit));
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // search_meetings   🔶 AI-invoking (embeddings)
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "search_meetings",
    {
      title: "Search meetings and transcripts",
      description:
        "Search across all meeting transcripts, imported conversations and intelligence " +
        "documents. Tries semantic (meaning-based) search first and falls back to keyword " +
        "matching; the response reports which mode ran in `searchMode`. Returns snippets " +
        "with the source type and id so you can fetch the full record afterwards.",
      inputSchema: {
        query: z.string().describe("What to look for, in natural language."),
        limit: z.number().optional().describe("Max results, 1-100. Default 24."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const userId = ctx.principal.userId;
      const q = args.query?.trim();
      if (!q) return ok({ results: [], searchMode: "none" });

      // Semantic search embeds the query, which costs tokens. Own-key users
      // are never gated (checkTokenBudget handles that); platform users at
      // their cap fall through to keyword search rather than being refused,
      // because keyword search is free.
      const budget = await checkTokenBudget(userId);

      const { semanticSearchContent, keywordSearchSources } = await import(
        "../../services/content-indexer"
      );

      const limit = clampLimit(args.limit, 24);
      let searchMode: "semantic" | "keyword" = "keyword";
      let hits: any[] = [];

      if (budget.allowed) {
        try {
          // runWithAiContext binds the userId that ai-provider reads to decide
          // platform-key vs the user's own Claude key. Without it, an own-key
          // user's embedding call would silently bill the platform.
          const out = await runWithAiContext({ userId }, () =>
            semanticSearchContent(userId, q, {
              topK: limit,
              sourceTypes: MEETING_SOURCE_TYPES,
            }),
          );
          if (out.mode === "semantic") {
            searchMode = "semantic";
            hits = out.hits;
          }
        } catch (err: any) {
          console.error("[mcp] semantic meetings search failed:", err?.message || err);
        }
      }

      if (searchMode === "keyword" || hits.length === 0) {
        hits = await keywordSearchSources(userId, q, MEETING_SOURCE_TYPES, limit);
        searchMode = hits.length && searchMode === "semantic" ? "semantic" : "keyword";
      }

      const results = hits.slice(0, limit).map((h: any) => ({
        sourceType: h.sourceType,
        sourceId: h.sourceId,
        sourceLabel: h.metadata?.sourceLabel || `${h.sourceType} #${h.sourceId}`,
        snippet: String(h.content || "").slice(0, 400),
        similarity: typeof h.similarity === "number" ? h.similarity : null,
      }));

      return ok({
        results,
        searchMode,
        budgetExceeded: !budget.allowed || undefined,
        note:
          !budget.allowed
            ? "Semantic search was skipped because the monthly AI token budget is exhausted. " +
              "These are keyword matches only."
            : undefined,
      });
    }),
  );
}
