import { getAiClient } from "./ai-provider";
import { getModelForBudget, trackTokenUsage } from "./token-tracker";
import { memoryManager } from "./memory-manager";
import { storage } from "../database-storage";
import type {
  Theme,
  ThemeMention,
  InsertThemeMention,
  CustomerTier,
} from "@shared/schema";

const openai = getAiClient() as any;

// ── Embeddings (semantic dedup + search) ─────────────────────────────────────
// Reuses the app's Gemini text-embedding-004 (768-dim) provider. Returns null
// when no embedding provider is configured; callers degrade to keyword matching.

async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return await memoryManager.getEmbedding(trimmed.slice(0, 2000));
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Two themes are considered the same topic at/above this cosine similarity.
const THEME_MERGE_SIMILARITY = 0.86;

// ── Types ──────────────────────────────────────────────────────────────────

export interface ParsedSegment {
  quote: string;
  speaker: string | null;
  timestampSeconds: number | null;
  timestampLabel: string | null;
}

export interface SourceDocument {
  sourceType: string; // zoom | google_meet | teams | conversation | evidence
  sourceId: number | null;
  sourceLabel: string;
  recordingUrl: string | null;
  participants: string[];
  text: string;
}

interface CandidateMention {
  quote: string;
  speaker: string | null;
  company: string | null;
  timestampSeconds: number | null;
  timestampLabel: string | null;
  sourceType: string;
  sourceId: number | null;
  sourceLabel: string;
  recordingUrl: string | null;
  deepLink: string | null;
  dedupeKey: string;
}

// ── Customer tier weighting ─────────────────────────────────────────────────

const DEFAULT_TIER_WEIGHTS: Record<string, number> = {
  enterprise: 3,
  mid_market: 2,
  smb: 1,
  standard: 1,
};

export function defaultWeightForTier(tier: string): number {
  return DEFAULT_TIER_WEIGHTS[tier] ?? 1;
}

const COMMON_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "live.com",
  "me.com",
  "msn.com",
]);

// ── Transcript parsing ───────────────────────────────────────────────────────
// Guardrail: quotes and speakers/timestamps come from OUR parsing of the stored
// text. The AI never invents them; it only clusters and names the themes.

function toSeconds(h: string | undefined, m: string, s: string | undefined): number {
  const hours = h ? parseInt(h, 10) : 0;
  const mins = parseInt(m, 10);
  const secs = s ? parseInt(s, 10) : 0;
  return hours * 3600 + mins * 60 + secs;
}

function labelForSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Matches "[MM:SS] Speaker: text", "[HH:MM:SS] Speaker: text",
// "[MM:SS - MM:SS] Speaker: text" (en-dash or hyphen).
const RE_TS_SPEAKER =
  /^\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\s*[–-]\s*(?:\d{1,2}:)?\d{1,2}:\d{2})?\]\s*([^:\]]{1,60}?):\s*(.+)$/;
// "[MM:SS] text" (no speaker)
const RE_TS_ONLY =
  /^\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\s*[–-]\s*(?:\d{1,2}:)?\d{1,2}:\d{2})?\]\s*(.+)$/;
// "MM:SS Speaker: text" (bare leading timestamp)
const RE_BARE_TS_SPEAKER =
  /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+([^:]{1,60}?):\s*(.+)$/;
// "Speaker: text" (no timestamp) — speaker limited to name-ish tokens
const RE_SPEAKER_ONLY = /^([A-Za-z][A-Za-z0-9 .'_-]{1,48}?):\s*(.+)$/;

export function parseTranscriptSegments(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let m = line.match(RE_TS_SPEAKER);
    if (m) {
      const secs = toSeconds(m[1], m[2], m[3]);
      const quote = m[5].trim();
      if (quote.length >= 8) {
        segments.push({
          quote,
          speaker: m[4].trim() || null,
          timestampSeconds: secs,
          timestampLabel: labelForSeconds(secs),
        });
      }
      continue;
    }

    m = line.match(RE_BARE_TS_SPEAKER);
    if (m) {
      const secs = toSeconds(m[1], m[2], m[3]);
      const quote = m[5].trim();
      if (quote.length >= 8) {
        segments.push({
          quote,
          speaker: m[4].trim() || null,
          timestampSeconds: secs,
          timestampLabel: labelForSeconds(secs),
        });
      }
      continue;
    }

    m = line.match(RE_TS_ONLY);
    if (m) {
      const secs = toSeconds(m[1], m[2], m[3]);
      const quote = m[4].trim();
      if (quote.length >= 8) {
        segments.push({
          quote,
          speaker: null,
          timestampSeconds: secs,
          timestampLabel: labelForSeconds(secs),
        });
      }
      continue;
    }

    m = line.match(RE_SPEAKER_ONLY);
    if (m && m[2].trim().length >= 8) {
      segments.push({
        quote: m[2].trim(),
        speaker: m[1].trim() || null,
        timestampSeconds: null,
        timestampLabel: null,
      });
      continue;
    }

    // Plain line with no speaker/timestamp — keep meaningful ones.
    if (line.length >= 24) {
      segments.push({
        quote: line,
        speaker: null,
        timestampSeconds: null,
        timestampLabel: null,
      });
    }
  }

  return segments;
}

// ── Company attribution ──────────────────────────────────────────────────────

function companyFromEmail(email: string): string | null {
  const at = email.indexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain || COMMON_EMAIL_DOMAINS.has(domain)) return null;
  const root = domain.split(".")[0];
  if (!root) return null;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

// Returns the dominant external company for a set of participants, plus a map
// of participant-name -> company so we can attribute a specific speaker.
function buildCompanyAttribution(participants: string[]): {
  dominant: string | null;
  byName: Map<string, string>;
} {
  const byName = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const p of participants || []) {
    if (!p) continue;
    const company = companyFromEmail(p);
    if (!company) continue;
    counts.set(company, (counts.get(company) || 0) + 1);
    // Map the local-part / display name to the company.
    const local = p.includes("@") ? p.slice(0, p.indexOf("@")) : p;
    const nameKey = local.replace(/[._-]+/g, " ").trim().toLowerCase();
    if (nameKey) byName.set(nameKey, company);
    byName.set(p.trim().toLowerCase(), company);
  }

  let dominant: string | null = null;
  let best = 0;
  Array.from(counts.entries()).forEach(([company, count]) => {
    if (count > best) {
      best = count;
      dominant = company;
    }
  });

  return { dominant, byName };
}

function attributeCompany(
  speaker: string | null,
  attribution: { dominant: string | null; byName: Map<string, string> },
): string | null {
  if (speaker) {
    const key = speaker.trim().toLowerCase();
    if (attribution.byName.has(key)) return attribution.byName.get(key)!;
    const entries = Array.from(attribution.byName.entries());
    for (const [name, company] of entries) {
      if (key.includes(name) || name.includes(key)) return company;
    }
  }
  return attribution.dominant;
}

// ── Deep link (never fabricated) ─────────────────────────────────────────────

export function buildDeepLink(
  recordingUrl: string | null,
  timestampSeconds: number | null,
): string | null {
  if (!recordingUrl || timestampSeconds == null) return null;
  // Standard media-fragment; the timestamp itself is real (parsed from the
  // transcript). If the URL already carries a fragment, leave it untouched.
  if (recordingUrl.includes("#")) return recordingUrl;
  return `${recordingUrl}#t=${timestampSeconds}`;
}

// ── Source collection ────────────────────────────────────────────────────────

// Normalises a raw source string into a first-class channel the UI groups by.
// Slack and support-ticket systems become their own channels rather than being
// lumped under a generic "conversation" bucket.
const SUPPORT_SOURCES = new Set([
  "support",
  "support_ticket",
  "ticket",
  "zendesk",
  "intercom",
  "freshdesk",
  "helpscout",
  "front",
]);

function normalizeSourceType(raw: string | null | undefined): string {
  const s = (raw || "").toLowerCase().trim();
  if (!s || s === "manual") return "conversation";
  if (s === "slack") return "slack";
  if (SUPPORT_SOURCES.has(s)) return "support";
  return s;
}

// Meeting-Intelligence documents carry human-facing source labels
// ("Microsoft Teams", "Google Meet", …). Map them to the Theme Finder's
// canonical source types so breakdowns stay consistent.
const MEETING_SOURCE_MAP: Record<string, string> = {
  zoom: "zoom",
  "microsoft teams": "teams",
  teams: "teams",
  "google meet": "google_meet",
  slack: "slack",
  discord: "discord",
  email: "email",
  "audio/video": "audio",
  "pdf/docx/txt": "upload",
  other: "conversation",
};

function mapMeetingSource(raw: string | null | undefined): string {
  const s = (raw || "").toLowerCase().trim();
  return MEETING_SOURCE_MAP[s] || normalizeSourceType(raw);
}

export async function collectSourceDocuments(userId: string): Promise<SourceDocument[]> {
  const docs: SourceDocument[] = [];

  const [zoom, gmeet, teams, conversations, evidence, intelDocs] = await Promise.all([
    storage.getZoomMeetings(userId).catch(() => []),
    storage.getGoogleMeetMeetings(userId).catch(() => []),
    storage.getTeamsMeetings(userId).catch(() => []),
    storage.getConversations(userId).catch(() => []),
    storage.getEvidenceItems(userId).catch(() => []),
    (storage.getCompletedIntelligenceDocuments?.(userId) ?? Promise.resolve([])).catch(
      () => [],
    ),
  ]);

  for (const m of zoom) {
    if (m.transcript && m.transcript.trim()) {
      docs.push({
        sourceType: "zoom",
        sourceId: m.id,
        sourceLabel: m.subject || `Zoom meeting #${m.id}`,
        recordingUrl: m.recordingUrl || null,
        participants: m.attendees || [],
        text: m.transcript,
      });
    }
  }
  for (const m of gmeet) {
    if (m.transcript && m.transcript.trim()) {
      docs.push({
        sourceType: "google_meet",
        sourceId: m.id,
        sourceLabel: m.subject || `Google Meet #${m.id}`,
        recordingUrl: m.recordingUrl || null,
        participants: m.attendees || [],
        text: m.transcript,
      });
    }
  }
  for (const m of teams) {
    if (m.transcript && m.transcript.trim()) {
      docs.push({
        sourceType: "teams",
        sourceId: m.id,
        sourceLabel: m.subject || `Teams meeting #${m.id}`,
        recordingUrl: null, // Teams meetings carry no recording URL in schema
        participants: m.attendees || [],
        text: m.transcript,
      });
    }
  }
  for (const c of conversations) {
    if (c.content && c.content.trim()) {
      const sourceType = normalizeSourceType(c.source);
      const defaultLabel =
        sourceType === "slack"
          ? `Slack thread #${c.id}`
          : sourceType === "support"
            ? `Support ticket #${c.id}`
            : `Conversation #${c.id}`;
      docs.push({
        sourceType,
        sourceId: c.id,
        sourceLabel: c.title || defaultLabel,
        recordingUrl: null,
        participants: c.participants || [],
        text: c.content,
      });
    }
  }
  // Bulk-uploaded transcripts processed by Meeting Intelligence (spec step 1:
  // "uploaded transcripts"). Only completed docs carry usable transcript text.
  for (const d of intelDocs as any[]) {
    if (d?.transcriptText && String(d.transcriptText).trim()) {
      docs.push({
        sourceType: mapMeetingSource(d.meetingSource),
        sourceId: d.id,
        sourceLabel: d.meetingTitle || d.projectName || `Transcript #${d.id}`,
        recordingUrl: null,
        participants: Array.isArray(d.participants) ? d.participants : [],
        text: String(d.transcriptText),
      });
    }
  }
  for (const e of evidence) {
    if (e.content && e.content.trim()) {
      // Evidence rows can themselves originate from Slack/support imports; honour
      // that source so the theme's breakdown stays accurate.
      const sourceType =
        (e as any).source && (e as any).source !== "note"
          ? normalizeSourceType((e as any).source)
          : "evidence";
      docs.push({
        sourceType,
        sourceId: e.id,
        sourceLabel: e.title || `Evidence #${e.id}`,
        recordingUrl: null,
        participants: [],
        text: `${e.title}\n${e.content}`,
      });
    }
  }

  return docs;
}

// ── Candidate mention extraction ─────────────────────────────────────────────

function makeDedupeKey(m: {
  sourceType: string;
  sourceId: number | null;
  timestampSeconds: number | null;
  quote: string;
}): string {
  const q = m.quote.slice(0, 60).toLowerCase().replace(/\s+/g, " ").trim();
  return `${m.sourceType}:${m.sourceId ?? "x"}:${m.timestampSeconds ?? "x"}:${q}`;
}

// Caps per document keep token usage bounded on large transcripts.
const MAX_SEGMENTS_PER_DOC = 120;
const MAX_TOTAL_SEGMENTS = 400;
const MAX_QUOTE_CHARS = 400;

export function buildCandidateMentions(docs: SourceDocument[]): CandidateMention[] {
  const mentions: CandidateMention[] = [];

  for (const doc of docs) {
    const attribution = buildCompanyAttribution(doc.participants);
    const segments = parseTranscriptSegments(doc.text).slice(0, MAX_SEGMENTS_PER_DOC);

    for (const seg of segments) {
      const quote = seg.quote.slice(0, MAX_QUOTE_CHARS);
      const company = attributeCompany(seg.speaker, attribution);
      const deepLink = buildDeepLink(doc.recordingUrl, seg.timestampSeconds);
      const candidate: CandidateMention = {
        quote,
        speaker: seg.speaker,
        company,
        timestampSeconds: seg.timestampSeconds,
        timestampLabel: seg.timestampLabel,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        sourceLabel: doc.sourceLabel,
        recordingUrl: doc.recordingUrl,
        deepLink,
        dedupeKey: "",
      };
      candidate.dedupeKey = makeDedupeKey(candidate);
      mentions.push(candidate);
    }
  }

  return mentions.slice(0, MAX_TOTAL_SEGMENTS);
}

// ── AI clustering ────────────────────────────────────────────────────────────

interface ClusteredTheme {
  title: string;
  description: string;
  category: string | null;
  confidence: number; // 0..1, how confident the model is this is a real recurring theme
  mentionIndexes: number[];
}

const CLUSTER_PROMPT = `You are a product-intelligence analyst helping a product leader find recurring themes across customer conversations.

You will receive a numbered list of real quotes pulled from meetings, calls, support tickets, and notes. Your job is to CLUSTER these quotes into specific, nuanced recurring sub-themes — NOT broad buckets.

Rules:
- Prefer specific sub-themes over vague ones. For example, instead of one "classification" theme, split into "Table classification errors", "Figure/image classification errors", "Checkbox detection failing", etc., if the quotes support that granularity.
- Each theme MUST reference the indexes of the quotes that belong to it (from the provided list). Only use indexes that appear in the list.
- A quote can belong to at most one theme. Ignore quotes that are small talk, logistics, or not a real product problem/request.
- Give each theme a short "title" (5-9 words), a one-sentence "description", and an optional broad "category".
- Include a "confidence" between 0 and 1 reflecting how strongly the quotes support this being a real, recurring product theme (higher = stronger, clearer signal).
- DO NOT invent quotes or paraphrase — you only cluster by referencing indexes. The exact quote text is handled by the system.
- Aim for quality: only surface themes with genuine recurring signal.

Respond ONLY with valid JSON of this exact shape:
{
  "themes": [
    { "title": "...", "description": "...", "category": "...", "confidence": 0.9, "mentionIndexes": [0, 4, 9] }
  ]
}`;

async function clusterMentions(
  userId: string,
  mentions: CandidateMention[],
): Promise<ClusteredTheme[]> {
  if (mentions.length === 0) return [];

  const numbered = mentions
    .map((m, i) => {
      const who = m.speaker ? ` (${m.speaker}${m.company ? `, ${m.company}` : ""})` : m.company ? ` (${m.company})` : "";
      return `[${i}]${who} ${m.quote}`;
    })
    .join("\n");

  const model = await getModelForBudget(userId, "gpt-4o");
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: CLUSTER_PROMPT },
      { role: "user", content: `Quotes:\n\n${numbered}` },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  if (completion.usage) {
    trackTokenUsage(userId, "theme-finder", model, completion.usage).catch(() => {});
  }

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: { themes?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const out: ClusteredTheme[] = [];
  if (Array.isArray((parsed as any).themes)) {
    for (const t of (parsed as any).themes) {
      if (!t || typeof t.title !== "string" || !Array.isArray(t.mentionIndexes)) continue;
      const idxs = (t.mentionIndexes as any[]).filter(
        (n: any) => Number.isInteger(n) && n >= 0 && n < mentions.length,
      ) as number[];
      if (idxs.length === 0) continue;
      const rawConf = typeof t.confidence === "number" ? t.confidence : NaN;
      const confidence = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.6;
      out.push({
        title: t.title.trim(),
        description: typeof t.description === "string" ? t.description.trim() : "",
        category: typeof t.category === "string" && t.category.trim() ? t.category.trim() : null,
        confidence,
        mentionIndexes: Array.from(new Set<number>(idxs)),
      });
    }
  }
  return out;
}

// ── Theme title similarity (mirrors evidence dedup approach) ──────────────────

function titlesMatch(a: string, b: string): boolean {
  const tA = a.toLowerCase().trim();
  const tB = b.toLowerCase().trim();
  if (tA === tB) return true;
  const shorter = tA.length < tB.length ? tA : tB;
  const longer = tA.length < tB.length ? tB : tA;
  if (shorter.length > 5 && longer.includes(shorter)) return true;
  const w1 = tA.split(/\s+/);
  const w2 = new Set(tB.split(/\s+/));
  const inter = w1.filter((w) => w2.has(w));
  const uni = new Set(w1.concat(tB.split(/\s+/)));
  return uni.size > 0 && inter.length / uni.size >= 0.6;
}

// ── Weighting ────────────────────────────────────────────────────────────────

function resolveWeight(
  company: string | null,
  tierMap: Map<string, CustomerTier>,
): { tier: string; weight: number } {
  if (company) {
    const hit = tierMap.get(company.toLowerCase());
    if (hit) return { tier: hit.tier, weight: hit.weight };
  }
  return { tier: "standard", weight: DEFAULT_TIER_WEIGHTS.standard };
}

// ── Main entry ───────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  themesCreated: number;
  themesUpdated: number;
  mentionsAdded: number;
  segmentsScanned: number;
  sourcesScanned: number;
}

export async function analyzeThemes(userId: string): Promise<AnalyzeResult> {
  const docs = await collectSourceDocuments(userId);
  const candidates = buildCandidateMentions(docs);

  if (candidates.length === 0) {
    return {
      themesCreated: 0,
      themesUpdated: 0,
      mentionsAdded: 0,
      segmentsScanned: 0,
      sourcesScanned: docs.length,
    };
  }

  const clusters = await clusterMentions(userId, candidates);

  // Embed each cluster (title + description) once, for semantic dedup against
  // existing themes and to persist for future semantic search. Null entries
  // (no embedding provider) fall back to title-similarity dedup.
  const clusterEmbeddings = await Promise.all(
    clusters.map((c) => embedText(`${c.title}. ${c.description}`)),
  );

  const tiers = await storage.getCustomerTiers(userId);
  const tierMap = new Map<string, CustomerTier>();
  for (const t of tiers) tierMap.set(t.company.toLowerCase(), t);

  const existingThemes = (await storage.getThemes(userId)) as Theme[];
  const existingMentions = await storage.getThemeMentionsForUser(userId);
  const seenDedupe = new Set(existingMentions.map((m) => m.dedupeKey).filter(Boolean) as string[]);

  let themesCreated = 0;
  let themesUpdated = 0;
  let mentionsAdded = 0;

  for (let ci = 0; ci < clusters.length; ci++) {
    const cluster = clusters[ci];
    const clusterEmbedding = clusterEmbeddings[ci];

    // Find the theme this cluster belongs to. Prefer embedding similarity
    // (step 5: dedup on meaning, not surface wording); fall back to title match
    // when embeddings are unavailable.
    let theme: Theme | undefined;
    if (clusterEmbedding) {
      let bestSim = 0;
      let bestTheme: Theme | undefined;
      for (const t of existingThemes) {
        const emb = (t as any).embedding as number[] | null;
        if (!emb || emb.length === 0) continue;
        const sim = cosineSimilarity(clusterEmbedding, emb);
        if (sim > bestSim) {
          bestSim = sim;
          bestTheme = t;
        }
      }
      if (bestTheme && bestSim >= THEME_MERGE_SIMILARITY) theme = bestTheme;
    }
    if (!theme) theme = existingThemes.find((t) => titlesMatch(t.title, cluster.title));

    let isNew = false;
    if (!theme) {
      theme = await storage.createTheme({
        userId,
        title: cluster.title,
        description: cluster.description || null,
        category: cluster.category,
        mentionCount: 0,
        distinctSourceCount: 0,
        weightedScore: 0,
        status: "active",
        metadata: {},
      });
      if (clusterEmbedding) {
        theme = await storage.updateTheme(theme.id, { embedding: clusterEmbedding } as any);
      }
      existingThemes.push(theme);
      isNew = true;
      themesCreated++;
    } else if (
      clusterEmbedding &&
      (!(theme as any).embedding || (theme as any).embedding.length === 0)
    ) {
      // Backfill an embedding on a matched theme that predates semantic search.
      const updated = await storage.updateTheme(theme.id, { embedding: clusterEmbedding } as any);
      const idx = existingThemes.findIndex((t) => t.id === theme!.id);
      if (idx >= 0) existingThemes[idx] = updated;
      theme = updated;
    }

    let added = 0;
    for (const idx of cluster.mentionIndexes) {
      const c = candidates[idx];
      if (!c) continue;
      if (seenDedupe.has(c.dedupeKey)) continue;
      seenDedupe.add(c.dedupeKey);

      const { tier, weight } = resolveWeight(c.company, tierMap);
      const mention: InsertThemeMention = {
        userId,
        themeId: theme.id,
        quote: c.quote,
        speaker: c.speaker,
        company: c.company,
        customerTier: tier,
        weight,
        confidence: cluster.confidence,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        sourceLabel: c.sourceLabel,
        timestampSeconds: c.timestampSeconds,
        timestampLabel: c.timestampLabel,
        recordingUrl: c.recordingUrl,
        deepLink: c.deepLink,
        dedupeKey: c.dedupeKey,
        metadata: {},
      };
      await storage.createThemeMention(mention);
      added++;
      mentionsAdded++;
    }

    if (isNew && added === 0) {
      // Every clustered mention was already recorded (drifted title created a
      // fresh theme). Remove it so re-analyze never accumulates empty themes.
      await storage.deleteTheme(theme.id);
      const idx = existingThemes.findIndex((t) => t.id === theme!.id);
      if (idx >= 0) existingThemes.splice(idx, 1);
      themesCreated--;
      continue;
    }

    if (added > 0 || isNew) {
      await recomputeThemeAggregates(theme.id);
      if (!isNew) themesUpdated++;
    }
  }

  return {
    themesCreated,
    themesUpdated,
    mentionsAdded,
    segmentsScanned: candidates.length,
    sourcesScanned: docs.length,
  };
}

// Recompute mentionCount, distinctSourceCount, and the customer-weighted score
// from the theme's stored mentions. weightedScore = sum of mention weights.
export async function recomputeThemeAggregates(themeId: number): Promise<Theme> {
  const mentions = await storage.getThemeMentions(themeId);
  const distinctSources = new Set(
    mentions.map((m) => `${m.sourceType}:${m.sourceId ?? "x"}`),
  );
  const weightedScore = mentions.reduce((sum, m) => sum + (m.weight || 1), 0);
  // Last seen = most recent mention's ingest time (step 6).
  let lastSeenAt: Date | null = null;
  for (const m of mentions) {
    if (m.createdAt && (!lastSeenAt || m.createdAt > lastSeenAt)) {
      lastSeenAt = m.createdAt as Date;
    }
  }
  return storage.updateTheme(themeId, {
    mentionCount: mentions.length,
    distinctSourceCount: distinctSources.size,
    weightedScore,
    ...(lastSeenAt ? { lastSeenAt } : {}),
  });
}

// ── Source breakdown helper ──────────────────────────────────────────────────

export function summarizeSourceBreakdown(mentions: ThemeMention[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const m of mentions) {
    breakdown[m.sourceType] = (breakdown[m.sourceType] || 0) + 1;
  }
  return breakdown;
}
