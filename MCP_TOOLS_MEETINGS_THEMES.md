# MCP Function Inventory — Meetings + Theme Finder

Scope narrowed per decision: Phase A exposes **Meetings** and **Theme Finder** only.
Companion to [MCP_INTEGRATION_PLAN.md](MCP_INTEGRATION_PLAN.md).

---

## 0. Why these two together

They are one pipeline, not two features:

```
Zoom / Meet / Teams transcripts ─┐
Manual imports                   ├─→ collectSourceDocuments()
Audio (Whisper)                  │       │
Evidence items                   │       ▼
Completed intelligence docs ─────┘   parseTranscriptSegments()   ← quotes/speakers/
                                         │                          timestamps come from
                                         ▼                          OUR regex parsing
                                     clusterMentions()  ← AI only names + groups
                                         │
                                         ▼
                                   themes + theme_mentions
                                   (weighted by customer tier)
```

**The critical property to preserve in MCP:** per [server/services/theme-analyzer.ts:131](server/services/theme-analyzer.ts) — *"quotes and speakers/timestamps come from OUR parsing of the stored text. The AI never invents them; it only clusters and names the themes."*

Every theme mention is therefore verifiable against a real transcript line. MCP tools must expose the traceability path (`get_theme_source_transcript`) alongside the claims, or an agent consuming themes loses the one guarantee that makes them trustworthy.

---

## 1. Meetings — tools

### Read (`read` scope)

| # | Tool | Params | Backed by | Notes |
|---|---|---|---|---|
| 1 | `list_meetings` | `source?`, `dateFrom?`, `dateTo?`, `hasTranscript?`, `limit`, `cursor` | ⚠️ **must be built** | Unified across zoom/google_meet/teams. Currently merged client-side only in the "All" tab — no server endpoint exists. |
| 2 | `get_meeting` | `source`, `meetingId` | provider tables | Metadata, attendees, status, transcript-available flag. Guard required. |
| 3 | `get_meeting_transcript` | `source`, `meetingId`, `offset`, `limit` | provider tables | ⚠️ **must paginate** — transcripts run to hundreds of KB. |
| 4 | `list_conversations` | `source?`, `limit`, `cursor` | `GET /api/conversations` | Manual + Whisper transcriptions — the records `list_meetings` misses. |
| 5 | `search_meetings` | `q`, `limit` | `GET /api/meetings/search` | Semantic w/ keyword fallback. **Returns `searchMode`** — pass it through so the agent knows which ran. 🔶 AI |
| 6 | `ask_meetings` | `question`, `history?` | `POST /api/meetings/ask` | RAG grounded only in retrieved passages. Non-streaming variant needed. 🔶 AI |

### Intelligence read (`read` scope)

| # | Tool | Params | Notes |
|---|---|---|---|
| 7 | `list_intelligence_documents` | `status?`, `batchId?`, `projectName?`, `department?`, `meetingSource?`, `dateFrom/To?`, `limit`, `cursor` | |
| 8 | `get_intelligence_document` | `documentId`, `format: json\|markdown` | **Highest-value tool in the set.** Returns pre-extracted decisions, action_items (task/owner/deadline/status/source_quote), risks, next_steps, confidence_score. Structured and evidence-backed — far cheaper for an agent than re-reading raw transcript. |
| 9 | `list_intelligence_batches` | `limit`, `cursor` | |
| 10 | `get_batch_summary` | `batchId` | Aggregated actions/decisions across a whole batch + progress counters. |

### Write (`write` scope)

| # | Tool | Params | Notes |
|---|---|---|---|
| 11 | `create_conversation` | `title`, `content`, `source`, `participants?`, `meetingDate?`, `tags?` | The agent's data-in path. Auto-feeds evidence via `findOrBumpEvidence`. |
| 12 | `save_meeting_transcript` | `source`, `meetingId`, `transcript` | Paste-transcript equivalent, per provider. |
| 13 | `fetch_meeting_transcript` | `source`, `meetingId` | Triggers provider-side retrieval (Zoom recording / Drive / Graph). Not AI, but external OAuth call — fails often, needs a clear `isError` message. |
| 14 | `process_transcript` | `transcriptText`, `meetingSource`, `projectName?`, `department?`, `meetingDate?`, `participants?` | Runs the MOM extractor on one transcript. 🔶 AI |
| 15 | `enqueue_bulk_transcripts` | `transcripts[]`, `label?`, `defaultMeetingSource?` | Returns `batchId`; agent polls `get_batch_summary`. 🔶 AI ⏱️ **needs a hard cap** — the service accepts 2,000+. |
| 16 | `reprocess_intelligence_document` | `documentId` | Re-run after a prompt change. 🔶 AI |

### Deliberately excluded from v1

`create_meeting` / `update_meeting` / `delete_meeting` on Zoom, Meet, and Teams. These **send real calendar invites and emails to real people** — outward-facing, hard-to-reverse side effects. They need a confirmation story that doesn't exist yet. Same reasoning excludes `delete_conversation`.

---

## 2. Theme Finder — tools

### Read (`read` scope)

| # | Tool | Params | Backed by | Notes |
|---|---|---|---|---|
| 17 | `list_themes` | `q?`, `minMentions?`, `category?`, `status?`, `sortBy`, `limit`, `cursor` | `GET /api/themes` | Semantic ranking w/ keyword fallback; returns `searchMode`. 🔶 AI when `q` present |
| 18 | `get_theme` | `themeId`, `mentionLimit` | `GET /api/themes/:id` | Title, description, mentionCount, distinctSourceCount, weightedScore, sourceBreakdown, tierBreakdown, companies, avgConfidence. ⚠️ **cap mentions** — a hot theme has hundreds. |
| 19 | `get_theme_mentions` | `themeId`, `sourceType?`, `company?`, `customerTier?`, `minConfidence?`, `limit`, `cursor` | `theme_mentions` | Paginated. Each returns quote, speaker, company, tier, weight, confidence, sourceLabel, timestampLabel, deepLink. |
| 20 | `get_theme_source_transcript` | `sourceType`, `sourceId`, `quote?` | `GET /api/theme-source-transcript` | **The traceability tool.** Resolves the raw transcript behind a mention so the agent can verify a quote in context. Pairs with the no-hallucinated-quotes guarantee. |
| 21 | `export_theme` | `themeId`, `format: markdown\|json` | `GET /api/themes/:id/export` | Fully rendered brief with traced mentions and deep links — paste-ready. |
| 22 | `list_customer_tiers` | — | `GET /api/customer-tiers` | company → tier → weight. **Required to interpret `weightedScore`**, which is otherwise an unexplained number. |

### Write (`write` scope)

| # | Tool | Params | Notes |
|---|---|---|---|
| 23 | `analyze_themes` | — | Full pipeline: collect → parse → cluster → embed → dedup → persist. 🔶 AI 💰 **most expensive tool in the set** ⏱️ long-running. |
| 24 | `update_theme` | `themeId`, `title?`, `description?`, `category?`, `status?` | Allowlisted fields via `pickAllowedFields`. |
| 25 | `merge_themes` | `sourceThemeId`, `targetThemeId` | Sets `status=merged` + `mergedIntoId`, recomputes aggregates. |
| 26 | `set_customer_tier` | `company`, `tier`, `weight?` | Directly reranks every theme's `weightedScore` — a real lever, worth exposing. |

### Excluded v1

`delete_theme` — destructive, and `merge_themes` covers the genuine use case (duplicate themes).

---

## 3. Resources

| URI | Content |
|---|---|
| `requisor://meeting/{source}/{id}/transcript` | raw transcript text |
| `requisor://meeting/intelligence/{docId}` | rendered MOM markdown |
| `requisor://meeting/intelligence/batch/{batchId}/summary` | batch rollup |
| `requisor://conversation/{id}` | conversation content |
| `requisor://theme/{themeId}` | theme brief markdown (reuses export renderer) |

`resources/list` returns only the caller's own rows.

---

## 4. Prompts

| Prompt | Args | Produces |
|---|---|---|
| `voice_of_customer` | `minMentions?`, `tier?` | VOC brief from themes, weighted by customer tier, with traced quotes |
| `meeting_followups` | `source`, `meetingId` | Action items + owners + deadlines from the intelligence doc |
| `theme_trend_report` | `sinceDate` | What's rising across themes, by mention frequency and tier weight |
| `weekly_meeting_digest` | — | Digest across all meetings in the last 7 days |

---

## 5. Cross-cutting requirements

### 5.1 Two things must be built, not wrapped

1. **Unified `list_meetings`** — no server endpoint exists; the "All" tab merges three queries client-side. Needs a real paginated endpoint.
2. **Paginated transcript reads** — every existing path returns the whole transcript column.

Everything else wraps logic that already exists.

### 5.2 Pagination is mandatory, not nice-to-have

A single unbounded `get_theme` or `get_meeting_transcript` can return hundreds of KB. That blows the model's context window *and* bills the user for it in one call. Every list and every text-returning tool takes `limit` + `cursor` and returns a truncation flag.

### 5.3 AI-invoking tools (🔶) need the full chain

`search_meetings`, `ask_meetings`, `list_themes` (semantic path), `process_transcript`, `enqueue_bulk_transcripts`, `reprocess_intelligence_document`, `analyze_themes`.

Each must: `requireAiBudget(userId, feature)` → run inside `runWithAiContext({ userId })` → use `getAiClient()` → `trackTokenUsage()`. Miss any link and an own-key user silently bills the platform, or a capped user bypasses their budget.

### 5.4 Long-running tools (⏱️) need start + poll, not blocking

`analyze_themes` and `enqueue_bulk_transcripts` exceed typical MCP client timeouts. Design:

```
analyze_themes        → returns { jobId, status: "running" }
get_analysis_status   → returns { status, themesCreated, mentionsAdded, ... }
```

`enqueue_bulk_transcripts` already fits this shape — it returns a `batchId` and the existing worker drains the queue.

### 5.5 Ownership guards

- `storage.getTheme(id)` returns **any** theme; the route checks `theme.userId !== userId` by hand. Every MCP theme tool must do the same.
- Provider meeting tables use `userId text` — always filter, never trust a bare id.
- `theme_mentions` and intelligence documents likewise.

### 5.6 Whisper cost is currently untracked

`/api/transcribe` logs `trackTokenUsage(..., { total_tokens: 0 })`. If an MCP tool ever triggers transcription, it inherits that hole. Not a blocker for this inventory — flagging it because Whisper bills per minute, so it needs a cost dimension that the token-based tracker doesn't currently have.

---

## 6. Summary count

| Group | Read | Write | Total |
|---|---|---|---|
| Meetings | 10 | 6 | 16 |
| Theme Finder | 6 | 4 | 10 |
| **Total tools** | **16** | **10** | **26** |
| Resources | | | 5 |
| Prompts | | | 4 |

26 tools is at the upper edge of comfortable — every tool schema is billed on every agent turn. If it proves too many in testing, the first candidates to merge are the four intelligence list/get pairs and `get_theme` / `get_theme_mentions`.
