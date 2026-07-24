/**
 * MCP tools — Meeting Intelligence (MOM extractor output).
 *
 * This is the highest-value read surface in the whole server. The extractor
 * has already turned raw transcripts into structured decisions, action items
 * (task / owner / deadline / status / source_quote), risks and next steps —
 * with a verbatim `evidence_quotes` array aligned by index to every list
 * field, so nothing here is an unsupported claim.
 *
 * Handing an agent that JSON is dramatically cheaper and more reliable than
 * making it re-read and re-summarise a 200KB transcript.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getIntelligenceDocument,
  listIntelligenceDocuments,
  listIntelligenceBatches,
  getBatchSummary,
} from "../../services/meeting-intelligence-service";
import { McpToolError, clampLimit, paginate, windowText } from "../guards";
import { ok, toolHandler, type McpToolContext } from "../runtime";

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function registerIntelligenceTools(server: McpServer, ctx: McpToolContext): void {
  // ───────────────────────────────────────────────────────────────────────
  // list_intelligence_documents
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "list_intelligence_documents",
    {
      title: "List meeting intelligence documents",
      description:
        "List processed meeting transcripts that have been turned into structured " +
        "minutes (decisions, action items, risks). Returns headline metadata only — " +
        "call get_intelligence_document for the full extraction. Filter by status to " +
        "find work still in progress ('queued', 'processing') or that failed.",
      inputSchema: {
        status: z
          .enum(["queued", "processing", "completed", "failed"])
          .optional()
          .describe("Filter by processing status."),
        meetingSource: z
          .string()
          .optional()
          .describe("Filter by origin, e.g. 'Zoom', 'Teams', 'Google Meet', 'Audio/Video'."),
        projectName: z.string().optional().describe("Filter by project name (case-insensitive)."),
        limit: z.number().optional().describe("Page size, 1-100. Default 25."),
        offset: z.number().optional().describe("Rows to skip."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      // The service caps its own fetch; pull a generous window then filter and
      // paginate here so the filters behave consistently.
      const rows = await listIntelligenceDocuments(ctx.principal.userId, 500);

      let filtered = rows;
      if (args.status) filtered = filtered.filter((r) => r.status === args.status);
      if (args.meetingSource) {
        const want = args.meetingSource.toLowerCase();
        filtered = filtered.filter((r) => (r.meetingSource || "").toLowerCase() === want);
      }
      if (args.projectName) {
        const want = args.projectName.toLowerCase();
        filtered = filtered.filter((r) => (r.projectName || "").toLowerCase().includes(want));
      }

      const shaped = filtered.map((r) => ({
        id: r.id,
        transcriptId: r.transcriptId,
        meetingTitle: r.meetingTitle,
        projectName: r.projectName,
        department: r.department,
        meetingSource: r.meetingSource,
        meetingDate: r.meetingDate,
        participants: Array.isArray(r.participants) ? r.participants : [],
        status: r.status,
        confidenceScore: r.confidenceScore,
        batchId: r.batchId,
        errorMessage: r.errorMessage,
        transcriptChars: (r.transcriptText || "").length,
        createdAt: toIso(r.createdAt),
      }));

      return ok(paginate(shaped, args.offset, args.limit));
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // get_intelligence_document
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_intelligence_document",
    {
      title: "Get meeting minutes and action items",
      description:
        "Fetch the full structured extraction for one processed transcript: executive " +
        "summary, discussion points, decisions taken, action items with owner and " +
        "deadline, risks, pending clarifications and next steps. Every list field has " +
        "an index-aligned `evidence_quotes` array holding the verbatim transcript line " +
        "it came from, so claims can be traced back to the source. Prefer this over " +
        "reading a raw transcript.",
      inputSchema: {
        documentId: z.number().describe("Document id, from list_intelligence_documents."),
        format: z
          .enum(["json", "markdown", "both"])
          .optional()
          .describe("json = structured extraction, markdown = rendered minutes. Default json."),
        includeTranscript: z
          .boolean()
          .optional()
          .describe("Include the first 20,000 characters of the source transcript. Default false."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      // The service already scopes by userId, so a miss is either a bad id or
      // someone else's row — both answer the same way.
      const doc = await getIntelligenceDocument(ctx.principal.userId, args.documentId);
      if (!doc) {
        throw new McpToolError(`No intelligence document found with id ${args.documentId}.`);
      }

      if (doc.status !== "completed") {
        return ok({
          id: doc.id,
          status: doc.status,
          errorMessage: doc.errorMessage,
          message:
            doc.status === "failed"
              ? "Processing failed for this transcript; no extraction is available."
              : "This transcript is still being processed. Try again shortly.",
        });
      }

      const format = args.format ?? "json";
      const payload: Record<string, unknown> = {
        id: doc.id,
        transcriptId: doc.transcriptId,
        meetingTitle: doc.meetingTitle,
        projectName: doc.projectName,
        department: doc.department,
        meetingSource: doc.meetingSource,
        meetingDate: doc.meetingDate,
        participants: Array.isArray(doc.participants) ? doc.participants : [],
        confidenceScore: doc.confidenceScore,
        chunkCount: doc.chunkCount,
        status: doc.status,
      };

      if (format === "json" || format === "both") payload.extraction = doc.documentJson;
      if (format === "markdown" || format === "both") payload.markdown = doc.documentMarkdown;

      if (args.includeTranscript) {
        payload.transcript = windowText(doc.transcriptText, 0);
      }

      return ok(payload);
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // list_intelligence_batches
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "list_intelligence_batches",
    {
      title: "List bulk processing batches",
      description:
        "List bulk transcript-processing batches with their progress counters " +
        "(total / completed / failed). Use get_batch_summary for the aggregated " +
        "decisions and action items across a whole batch.",
      inputSchema: {
        limit: z.number().optional().describe("Page size, 1-100. Default 25."),
        offset: z.number().optional().describe("Rows to skip."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const rows = await listIntelligenceBatches(ctx.principal.userId, 200);
      const shaped = rows.map((b) => ({
        id: b.id,
        label: b.label,
        status: b.status,
        totalCount: b.totalCount,
        completedCount: b.completedCount,
        failedCount: b.failedCount,
        createdAt: toIso(b.createdAt),
        completedAt: toIso(b.completedAt),
      }));
      return ok(paginate(shaped, args.offset, args.limit));
    }),
  );

  // ───────────────────────────────────────────────────────────────────────
  // get_batch_summary
  // ───────────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_batch_summary",
    {
      title: "Summarise a batch of meetings",
      description:
        "Aggregate the decisions, action items and risks extracted across every " +
        "transcript in one batch. Use this to answer questions spanning many meetings " +
        "at once, e.g. 'what are the open action items across all Q3 reviews'.",
      inputSchema: {
        batchId: z.number().describe("Batch id, from list_intelligence_batches."),
        limit: z.number().optional().describe("Max items per section. Default 50."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    toolHandler(async (args) => {
      const summary = await getBatchSummary(ctx.principal.userId, args.batchId);
      if (!summary) {
        throw new McpToolError(`No batch found with id ${args.batchId}.`);
      }

      // Batch summaries can span thousands of documents — cap every section so
      // one call cannot flood the model's context.
      const cap = clampLimit(args.limit, 50);
      const trim = <T>(arr: T[] | undefined): T[] => (Array.isArray(arr) ? arr.slice(0, cap) : []);
      const s = summary.summary;

      return ok({
        batch: summary.batch,
        sources: trim(summary.sources),
        summary: {
          discussion_points: trim(s.discussion_points),
          decisions_taken: trim(s.decisions_taken),
          risks: trim(s.risks),
          pending_clarifications: trim(s.pending_clarifications),
          next_steps: trim(s.next_steps),
          action_items: trim(s.action_items),
          executive_summaries: trim(s.executive_summaries),
          confidence: s.confidence,
          cited_count: s.cited_count,
          total_docs: s.total_docs,
        },
        truncatedTo: cap,
      });
    }),
  );
}
