/**
 * Unified content embedding index.
 *
 * Indexes imported content (meeting transcripts, Meeting Intelligence
 * outputs, conversations, evidence items) into `content_embeddings`,
 * chunked, keyed by (userId, sourceType, sourceId, chunkIndex), and provides
 * semantic search over the index plus a budget-aware backfill.
 *
 * Embeddings come from the unified embedding service (BYOK-aware). When
 * embeddings are unavailable for a user, indexing is skipped (logged) and
 * search callers degrade to keyword mode with a visible flag.
 */
import { db } from "../db";
import { contentEmbeddings } from "@shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  generateEmbeddings,
  tryGenerateEmbedding,
  isEmbeddingAvailable,
  EmbeddingUnavailableError,
} from "./embedding-service";
import { checkTokenBudget } from "./token-tracker";
import { runWithAiContext } from "./ai-context";
import { userHasOwnKey } from "./ai-provider";

// ── Chunking ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS_PER_SOURCE = 60;

export function chunkText(text: string): string[] {
  const clean = (text || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length && chunks.length < MAX_CHUNKS_PER_SOURCE) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    // Prefer breaking on a newline or sentence end near the boundary.
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const lastBreak = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(". "));
      if (lastBreak > CHUNK_SIZE * 0.5) end = start + lastBreak + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks.filter(Boolean);
}

// ── Indexing ────────────────────────────────────────────────────────────────

export interface IndexContentInput {
  userId: string;
  sourceType: string;
  sourceId: string | number;
  text: string;
  metadata?: Record<string, any>;
}

/**
 * (Re)index one source document: deletes existing chunks for the source and
 * inserts fresh embedded chunks. Throws on failure (callers choose to await
 * or fire-and-forget via safeIndexContent).
 */
export async function indexContent(input: IndexContentInput): Promise<number> {
  const sourceId = String(input.sourceId);
  const chunks = chunkText(input.text);

  await db
    .delete(contentEmbeddings)
    .where(
      and(
        eq(contentEmbeddings.userId, input.userId),
        eq(contentEmbeddings.sourceType, input.sourceType),
        eq(contentEmbeddings.sourceId, sourceId),
      ),
    );

  if (chunks.length === 0) return 0;

  const vectors = await generateEmbeddings(chunks, {
    userId: input.userId,
    feature: "content-indexing",
  });

  await db.insert(contentEmbeddings).values(
    chunks.map((content, i) => ({
      userId: input.userId,
      sourceType: input.sourceType,
      sourceId,
      chunkIndex: i,
      content,
      embedding: vectors[i],
      metadata: input.metadata || null,
    })),
  );
  return chunks.length;
}

/**
 * Fire-and-forget variant used by import/creation hooks. Never throws; logs
 * failures with context. Binds the AI context to the owning user so BYOK key
 * resolution works outside HTTP request scope.
 */
export function safeIndexContent(input: IndexContentInput): void {
  void runWithAiContext({ userId: input.userId }, async () => {
    try {
      await indexContent(input);
    } catch (err: any) {
      const level = err instanceof EmbeddingUnavailableError ? "warn" : "error";
      console[level](
        `[content-indexer] indexing failed (user=${input.userId}, source=${input.sourceType}:${input.sourceId}):`,
        err?.message || err,
      );
    }
  });
}

export async function removeFromIndex(
  sourceType: string,
  sourceId: string | number,
  userId?: string,
): Promise<void> {
  try {
    const conditions = [
      eq(contentEmbeddings.sourceType, sourceType),
      eq(contentEmbeddings.sourceId, String(sourceId)),
    ];
    if (userId) conditions.push(eq(contentEmbeddings.userId, userId));
    await db.delete(contentEmbeddings).where(and(...conditions));
  } catch (err) {
    console.error(
      `[content-indexer] failed to remove ${sourceType}:${sourceId} from index:`,
      err,
    );
  }
}

// ── Semantic search ─────────────────────────────────────────────────────────

export interface ContentSearchHit {
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  metadata: any;
  similarity: number;
}

export interface ContentSearchResult {
  hits: ContentSearchHit[];
  /** "semantic" when the vector path ran; "unavailable" when no embedding. */
  mode: "semantic" | "unavailable";
}

export async function semanticSearchContent(
  userId: string,
  query: string,
  opts: { topK?: number; sourceTypes?: string[]; threshold?: number } = {},
): Promise<ContentSearchResult> {
  const queryEmbedding = await tryGenerateEmbedding(query, {
    userId,
    feature: "semantic-search",
  });
  if (!queryEmbedding) return { hits: [], mode: "unavailable" };

  const topK = opts.topK ?? 20;
  const threshold = opts.threshold ?? 0.25;
  const similarity = sql<number>`1 - (${contentEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;

  const conditions = [eq(contentEmbeddings.userId, userId)];
  if (opts.sourceTypes && opts.sourceTypes.length > 0) {
    conditions.push(inArray(contentEmbeddings.sourceType, opts.sourceTypes));
  }

  const rows = await db
    .select({
      sourceType: contentEmbeddings.sourceType,
      sourceId: contentEmbeddings.sourceId,
      chunkIndex: contentEmbeddings.chunkIndex,
      content: contentEmbeddings.content,
      metadata: contentEmbeddings.metadata,
      similarity,
    })
    .from(contentEmbeddings)
    .where(and(...conditions, sql`${similarity} > ${threshold}`))
    .orderBy(sql`${similarity} DESC`)
    .limit(topK);

  return { hits: rows as ContentSearchHit[], mode: "semantic" };
}

// ── Source collection (canonical source types, aligned with import hooks) ──

interface IndexableSource {
  sourceType: string;
  sourceId: string | number;
  sourceLabel: string;
  text: string;
}

async function collectIndexableSources(userId: string): Promise<IndexableSource[]> {
  // Dynamic import avoids a load-time cycle (database-storage lazily imports
  // this module for its indexing hooks).
  const { storage } = await import("../database-storage");
  const docs: IndexableSource[] = [];

  const [zoom, gmeet, teams, convs, evidence, intelDocs] = await Promise.all([
    storage.getZoomMeetings(userId).catch(() => []),
    storage.getGoogleMeetMeetings(userId).catch(() => []),
    storage.getTeamsMeetings(userId).catch(() => []),
    storage.getConversations(userId).catch(() => []),
    storage.getEvidenceItems(userId).catch(() => []),
    ((storage as any).getCompletedIntelligenceDocuments?.(userId) ??
      Promise.resolve([])).catch(() => []),
  ]);

  for (const m of zoom as any[]) {
    if (m.transcript?.trim())
      docs.push({ sourceType: "zoom", sourceId: m.id, sourceLabel: m.subject || `Zoom meeting #${m.id}`, text: m.transcript });
  }
  for (const m of gmeet as any[]) {
    if (m.transcript?.trim())
      docs.push({ sourceType: "google_meet", sourceId: m.id, sourceLabel: m.subject || `Google Meet #${m.id}`, text: m.transcript });
  }
  for (const m of teams as any[]) {
    if (m.transcript?.trim())
      docs.push({ sourceType: "teams", sourceId: m.id, sourceLabel: m.subject || `Teams meeting #${m.id}`, text: m.transcript });
  }
  for (const c of convs as any[]) {
    if (c.content?.trim())
      docs.push({ sourceType: "conversation", sourceId: c.id, sourceLabel: c.title || `Conversation #${c.id}`, text: c.content });
  }
  for (const e of evidence as any[]) {
    if (e.content?.trim())
      docs.push({ sourceType: "evidence", sourceId: e.id, sourceLabel: e.title || `Evidence #${e.id}`, text: `${e.title || ""}\n${e.content}` });
  }
  for (const d of intelDocs as any[]) {
    const parts: string[] = [];
    if (d?.transcriptText?.trim()) parts.push(String(d.transcriptText));
    // Include the extracted intelligence (quotes/decisions/actions summary).
    if (d?.documentMarkdown?.trim()) parts.push(String(d.documentMarkdown));
    if (parts.length)
      docs.push({
        sourceType: "intelligence",
        sourceId: d.id,
        sourceLabel: d.meetingTitle || d.projectName || `Transcript #${d.id}`,
        text: parts.join("\n\n"),
      });
  }

  return docs;
}

/**
 * Keyword fallback search over the same canonical sources the semantic index
 * covers. Used when embeddings are unavailable so search never goes dark.
 * Returns pseudo-hits shaped like semantic hits (similarity omitted → 0).
 */
export async function keywordSearchSources(
  userId: string,
  query: string,
  sourceTypes?: string[],
  limit = 20,
): Promise<ContentSearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];

  const docs = await collectIndexableSources(userId);
  const filtered = sourceTypes && sourceTypes.length > 0
    ? docs.filter((d) => sourceTypes.includes(d.sourceType))
    : docs;

  const hits: ContentSearchHit[] = [];
  for (const doc of filtered) {
    const lower = doc.text.toLowerCase();
    // Score: number of distinct terms present; require at least one.
    const present = terms.filter((t) => lower.includes(t));
    if (present.length === 0) continue;
    // Snippet around the first matching term.
    const idx = lower.indexOf(present[0]);
    const start = Math.max(0, idx - 120);
    const end = Math.min(doc.text.length, idx + 240);
    const snippet =
      (start > 0 ? "…" : "") +
      doc.text.slice(start, end).trim() +
      (end < doc.text.length ? "…" : "");
    hits.push({
      sourceType: doc.sourceType,
      sourceId: String(doc.sourceId),
      chunkIndex: 0,
      content: snippet,
      metadata: { sourceLabel: doc.sourceLabel },
      similarity: present.length / terms.length,
    });
  }
  hits.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  return hits.slice(0, limit);
}

// ── Backfill ────────────────────────────────────────────────────────────────

export interface BackfillResult {
  indexed: number;
  skippedExisting: number;
  failed: number;
  stoppedForBudget: boolean;
  embeddingAvailable: boolean;
  totalSources: number;
}

/**
 * Batched, budget-aware backfill of all existing content for a user. Skips
 * sources that already have index rows (idempotent unless force=true).
 */
export async function backfillUserContent(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<BackfillResult> {
  const result: BackfillResult = {
    indexed: 0,
    skippedExisting: 0,
    failed: 0,
    stoppedForBudget: false,
    embeddingAvailable: await isEmbeddingAvailable(userId),
    totalSources: 0,
  };
  if (!result.embeddingAvailable) return result;

  const docs = await collectIndexableSources(userId);
  result.totalSources = docs.length;

  const existing = await db
    .select({
      sourceType: contentEmbeddings.sourceType,
      sourceId: contentEmbeddings.sourceId,
    })
    .from(contentEmbeddings)
    .where(eq(contentEmbeddings.userId, userId));
  const existingKeys = new Set(existing.map((r) => `${r.sourceType}:${r.sourceId}`));

  const ownKey = await userHasOwnKey(userId);

  for (const doc of docs) {
    if (doc.sourceId == null || !doc.text?.trim()) continue;
    const key = `${doc.sourceType}:${doc.sourceId}`;
    if (!opts.force && existingKeys.has(key)) {
      result.skippedExisting++;
      continue;
    }

    // Budget check between sources (platform-billed users only).
    if (!ownKey) {
      const budget = await checkTokenBudget(userId);
      if (!budget.allowed) {
        result.stoppedForBudget = true;
        break;
      }
    }

    try {
      await runWithAiContext({ userId }, () =>
        indexContent({
          userId,
          sourceType: doc.sourceType,
          sourceId: doc.sourceId!,
          text: doc.text,
          metadata: { sourceLabel: doc.sourceLabel },
        }),
      );
      result.indexed++;
    } catch (err: any) {
      result.failed++;
      console.error(
        `[content-indexer] backfill failed for ${key} (user=${userId}):`,
        err?.message || err,
      );
      if (err instanceof EmbeddingUnavailableError) break;
    }
  }

  console.log(
    `[content-indexer] backfill for user=${userId}: indexed=${result.indexed} skipped=${result.skippedExisting} failed=${result.failed} budgetStop=${result.stoppedForBudget}`,
  );
  return result;
}

// ── Status ──────────────────────────────────────────────────────────────────

export async function getSearchStatus(userId: string) {
  let vectorExtension = false;
  try {
    const r: any = await db.execute(
      sql`SELECT 1 FROM pg_extension WHERE extname = 'vector'`,
    );
    vectorExtension = (r.rows?.length ?? 0) > 0;
  } catch {
    vectorExtension = false;
  }

  const embeddingAvailable = await isEmbeddingAvailable(userId);

  let counts: Array<{ sourceType: string; chunks: number; sources: number }> = [];
  try {
    const rows = await db
      .select({
        sourceType: contentEmbeddings.sourceType,
        chunks: sql<number>`COUNT(*)`,
        sources: sql<number>`COUNT(DISTINCT ${contentEmbeddings.sourceId})`,
      })
      .from(contentEmbeddings)
      .where(eq(contentEmbeddings.userId, userId))
      .groupBy(contentEmbeddings.sourceType);
    counts = rows.map((r) => ({
      sourceType: r.sourceType,
      chunks: Number(r.chunks),
      sources: Number(r.sources),
    }));
  } catch {
    // table missing — reported via operational flag below
  }

  return {
    operational: vectorExtension && embeddingAvailable,
    vectorExtension,
    embeddingAvailable,
    indexed: counts,
    totalChunks: counts.reduce((s, c) => s + c.chunks, 0),
  };
}
