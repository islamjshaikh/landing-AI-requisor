# Requisor — MCP Integration Plan

**Status:** Draft for approval
**Decisions locked:** Both directions, phased — Phase A first. Auth via API tokens.

---

## 0. Objective

Two capabilities, delivered in order:

| Phase | Capability | Seam |
|---|---|---|
| **A** | Requisor **exposes** an MCP server so Claude Desktop / Claude Code / Cursor can read and act on Requisor data | `IStorage` |
| **B** | Requisor **consumes** external MCP servers so in-app AI agents gain tools without new connector code | `simple-ai-agent.ts` tool loop |

Phase A ships standalone and touches no existing runtime path. Phase B reuses A's credential-storage and registry patterns.

---

## 1. Non-negotiable constraints

These are derived from the codebase and `.agents/memory/`. Every task below is designed around them.

1. **Multi-tenancy.** All data is userId-scoped. An MCP session must be bound to exactly one userId.
2. **`getProject(id)` / `getTask(id)` are NOT access-checked.** They take a bare id. Every MCP tool must go through an explicit ownership guard — this is the single highest-risk item in Phase A.
3. **BYOK fails closed.** Any AI call must run inside `runWithAiContext({ userId }, …)` and use `getAiClient()`. A raw `new OpenAI()` inside an MCP tool bills the platform key for an own-key user.
4. **Token budgets.** AI-invoking tools need `checkTokenBudget()` before and `trackTokenUsage()` after, or MCP becomes an unmetered billing bypass.
5. **Do not add to `server/routes.ts`** (17,052 lines). All new code lives in new directories.
6. **`tsc` does not pass repo-wide.** Judge changes by filtering `tsc` output to new files only. Runtime is `tsx` (dev) / `esbuild` (prod).
7. **`npm run db:push` goes interactive on drift.** New tables get a direct-SQL migration in `scripts/`.
8. **Mount at `/api/mcp`, not `/mcp`.** The production SPA catch-all in `server/index.ts:326` only excludes `/api`, `/uploads`, `/media` — a bare `/mcp` would be swallowed and return `index.html`.

---

# PHASE A — Requisor as an MCP server

## A.1 Transport & mounting

- **Transport:** Streamable HTTP, **stateless mode** (fresh `McpServer` + `StreamableHTTPServerTransport` per request, `sessionIdGenerator: undefined`).
  Rationale: multi-tenant hosted SaaS on Neon serverless; no cross-request server state to leak between users; survives horizontal scaling with no sticky sessions.
- **Endpoint:** `POST /api/mcp`
- **Mounted:** in `server/index.ts`, immediately before `await registerRoutes(app)`.
- **Inherits for free:** existing JSON body parser, `no-cache` headers, SPA catch-all exclusion.
- **Adds:** a dedicated `mcpLimiter` in `server/security/rate-limiters.ts` (stricter than `apiLimiter` — agents retry aggressively).
- **CSP:** no change needed. This is server-to-server; no browser origin involved.

## A.2 Authentication — API tokens

### Token design

Format: `rq_mcp_<8-char prefix>_<43-char base64url secret>`

**Store a SHA-256 hash, not an encrypted value.** This differs deliberately from the BYOK key handling in `ai-provider.ts`: BYOK keys must be decrypted to be used, so they need AES-256-GCM. An API token only ever needs to be *verified*, so it should be a one-way hash — a DB leak then yields nothing usable.

Lookup: index on `token_prefix` for O(1) row fetch, then `timingSafeEqualStr()` (already in `server/security/helpers.ts:91`) against the hash. Never scan-and-compare.

### New table — `user_api_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | varchar → `users.id` ON DELETE CASCADE | |
| `name` | varchar | user-supplied label, e.g. "Claude Desktop – laptop" |
| `token_prefix` | varchar(8), indexed | non-secret lookup key |
| `token_hash` | varchar(64) | SHA-256 hex |
| `last4` | varchar(4) | for display |
| `scopes` | jsonb | `["read"]` or `["read","write"]` |
| `last_used_at` | timestamp null | |
| `expires_at` | timestamp null | null = no expiry |
| `revoked_at` | timestamp null | soft revoke, preserves audit trail |
| `created_at` | timestamp default now | |

Created via `scripts/create-mcp-tables.sql` + a small runner — **not** `db:push` (see constraint 7).

### Request flow

```
POST /api/mcp
  Authorization: Bearer rq_mcp_ab12cd34_<secret>
        │
        ├─ mcpLimiter
        ├─ resolveMcpToken()  → { userId, scopes, tokenId }   (401 on failure)
        ├─ touch last_used_at (fire-and-forget)
        └─ runWithAiContext({ userId }, () => transport.handleRequest(...))
```

Wrapping the *entire* request in `runWithAiContext` — not just individual AI calls — means any tool that transitively reaches an AI service inherits the correct userId automatically. This mirrors the existing pattern at `server/routes.ts:322`.

### Token management API

New file `server/routes/mcp-tokens.ts` (router, mounted from `registerRoutes`):

- `GET /api/mcp/tokens` — list (name, last4, scopes, lastUsedAt, createdAt). Never returns the secret.
- `POST /api/mcp/tokens` — create; returns the plaintext token **exactly once**.
- `DELETE /api/mcp/tokens/:id` — revoke.

All gated by `isAuthenticated` + `sensitiveAuthLimiter`.

## A.3 File layout

```
server/mcp/
  index.ts              createMcpHandler() — builds a per-request McpServer
  auth.ts               resolveMcpToken(), scope checks
  guards.ts             assertProjectAccess, assertTaskAccess, requireScope,
                        requireAiBudget
  tools/
    projects.ts
    tasks.ts
    evidence.ts
    features.ts
    meetings.ts
    account.ts
  resources/
    index.ts            registration + list handlers
  prompts/
    index.ts
server/services/api-tokens.ts     issue / verify / revoke / list
server/routes/mcp-tokens.ts       REST management endpoints
scripts/create-mcp-tables.sql     direct-SQL migration
```

## A.4 Guards (`server/mcp/guards.ts`)

The security core. Every tool calls these first.

```
assertProjectAccess(userId, projectId)
  → getProjectsForUser(userId) ∪ getProjectMember(projectId, userId)
  → throws McpAccessError if absent

assertTaskAccess(userId, taskId)
  → getTask(taskId) → resolve projectId → assertProjectAccess

requireScope(ctx, "write")
  → throws if token lacks the scope

requireAiBudget(userId, feature)
  → checkTokenBudget(); throws a clear "budget exceeded" tool error
```

`McpAccessError` is caught at the tool boundary and returned as `{ isError: true }` content — never as a protocol-level error, so the model can explain it to the user instead of the connection dying.

## A.5 Tool inventory (v1)

### Read scope — `["read"]`

| Tool | Backed by | Notes |
|---|---|---|
| `list_projects` | `getProjectsForUser` | already scoped; safe |
| `get_project` | `getProject` + guard | includes plan, milestones, progress |
| `list_tasks` | `getTasksForUser` / `getTasksByProjectId` | filters: projectId, status, assignee, overdue |
| `get_task` | `getTask` + guard | includes comments, attachments metadata |
| `search_evidence` | logic behind `GET /api/evidence/search` | |
| `list_feature_candidates` | feature candidates + RICE scores | |
| `list_meetings` | Zoom / Teams / Google Meet tables | |
| `get_meeting_transcript` | + guard | large — paginate |
| `get_token_budget` | `getTokenUsageSummary` | self-introspection; lets the agent see its own limits |

All annotated `readOnlyHint: true` so clients can auto-approve them.

### Write scope — `["read","write"]`

| Tool | Notes |
|---|---|
| `create_task` | mirrors `POST /api/tasks` validation |
| `update_task` | status / priority / assignee / dueDate only — allowlisted via `pickAllowedFields` |
| `create_evidence_item` | |
| `create_feature_candidate` | |

**No delete tools in v1.** Deliberate: destructive operations over an agent boundary need a confirmation story that doesn't exist yet.

### AI-invoking — `["read","write"]` + budget

| Tool | Notes |
|---|---|
| `prioritize_features` | wraps existing prioritisor logic. Included specifically to prove the `requireAiBudget` → `getAiClient()` → `trackTokenUsage` chain works end-to-end under MCP. |

## A.6 Resources (the read surface)

| URI | Content |
|---|---|
| `requisor://project/{projectId}` | project JSON |
| `requisor://project/{projectId}/plan` | generated plan, markdown |
| `requisor://evidence/{evidenceId}` | evidence item |
| `requisor://meeting/{provider}/{meetingId}/transcript` | transcript text |

`resources/list` returns only projects the authenticated user can access.

**Note:** resources are exposed *in addition to* the read tools above, not instead of them. Many clients require a human to attach a resource manually, so the tools are what make autonomous reads work. The resources make Requisor data attachable in Claude Desktop's UI.

## A.7 Prompts

- `weekly_status(projectId)`
- `discovery_report(projectId)`
- `sprint_plan(projectId)`

Surface in Claude Code as `/mcp__requisor__weekly_status`.

## A.8 Frontend

`client/src/pages/settings.tsx` — new **"MCP Access"** card, mirroring the existing "AI Provider" card:

- Create token: name + scope radio (read-only / read-write)
- One-time reveal with copy button and an explicit "you won't see this again" warning
- Table of active tokens: name, `····last4`, scopes, last used, revoke
- Collapsible "How to connect" with copy-paste config for Claude Code and Claude Desktop

## A.9 Milestones

| # | Deliverable | Est. |
|---|---|---|
| A1 | SDK dep, `user_api_tokens` table + SQL migration, `api-tokens.ts` service | 0.5d |
| A2 | `/api/mcp/tokens` REST + Settings UI | 1d |
| A3 | MCP transport mounted, auth middleware, one `list_projects` tool proving the path | 1d |
| A4 | `guards.ts` + all read tools | 1.5d |
| A5 | Write tools + `prioritize_features` with budget enforcement | 1d |
| A6 | Resources + prompts | 0.5d |
| A7 | MCP Inspector verification, docs in `DEVELOPER_DOCUMENTATION.md` | 0.5d |

**≈ 6 developer-days.**

## A.10 Verification

Primary tool is the MCP Inspector, run against the dev server with a real token:

```bash
npx @modelcontextprotocol/inspector
```

Point it at `http://localhost:5000/api/mcp` with an `Authorization: Bearer` header.

**Must-pass security checks before merge:**
1. Token for user A cannot read user B's project via `get_project` with a guessed numeric id.
2. A `read`-scope token is rejected by every write tool.
3. A revoked token returns 401.
4. An own-key (BYOK) user's `prioritize_features` call routes to Claude, never the platform OpenAI key.
5. A user at their token cap gets a clean budget error, not a silent platform call.

---

# PHASE B — Requisor as an MCP client

Begins after A ships. Sketched here to confirm the phases compose; will be re-planned in detail before starting.

## B.1 Integration point

`server/simple-ai-agent.ts:124` — the hardcoded `tools: [...]` array becomes:

```
tools: [...builtinTools, ...await getMcpToolsForUser(this.userId)]
```

Tool names are namespaced `mcp__<server>__<tool>`; the existing `tool_calls` dispatcher routes that prefix to the MCP executor instead of the local switch.

## B.2 New pieces

```
server/mcp-client/
  registry.ts    per-user connected servers (DB-backed)
  pool.ts        connection cache + lifecycle + health
  bridge.ts      MCP tool JSON Schema → OpenAI function schema
  execute.ts     dispatch, timeout, truncation, guards
```

New table `user_mcp_servers`: `user_id`, `name`, `transport` (http only initially), `url`, `headers_encrypted`, `enabled`, `tool_allowlist` jsonb, `created_at`.

Headers here **do** need AES-256-GCM via the existing `encryptAes256Gcm` / `deriveAesKeyFromSecret` helpers — unlike Phase A tokens, these must be decrypted to be sent.

## B.3 Risks specific to Phase B

| Risk | Mitigation |
|---|---|
| **Prompt injection via tool results.** External MCP output is untrusted data flowing straight into the model's context. | Wrap all MCP results in explicit data-delimiters; system prompt states tool output is data, never instructions. Highest-severity risk in this phase. |
| **Context bloat.** 5 servers × 20 tools = 100 tool schemas per request. | Hard cap on injected tools (~40) + per-server allowlist. |
| **Token spend.** Every extra tool schema is billed on every turn. | Route through `trackTokenUsage`; surface MCP overhead separately on the Token Usage page. |
| **Latency.** Remote tool calls inside a streaming response. | Per-call timeout (10s), connection pooling, degrade gracefully on server-down. |
| **Uncontrolled writes.** An external tool mutating a user's Jira. | Human-approval gate in the chat UI for anything without `readOnlyHint`. |

## B.4 Follow-on (Phase C, out of scope)

Once B is stable, `server/services/integration/` (Jira / Asana / Monday / Smartsheet, ~2,700 lines) can be progressively retired in favour of MCP servers, and future connectors become configuration rather than code.

---

## 2. Open questions for later

- Should MCP tokens be plan-gated (e.g. Builder tier and above)? Affects `getUserPlanSlug()` usage in A.2.
- Do we need per-project scoping on tokens, or is per-user sufficient for v1? Current plan: per-user.
- Phase B stdio transport for local dev servers — needed, or HTTP-only?
