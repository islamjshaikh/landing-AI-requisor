# Requisor MCP — OAuth 2.1 Integration Plan

**Status:** Draft for approval
**Goal:** one-click connect — user pastes a URL into Claude/Cursor, approves in a
browser, done. No token to copy, no config file to edit.
**Builds on:** the working API-token MCP server (Phase A).

---

## 0. The core insight that makes this affordable

OAuth is only a **different way to mint a token**. Everything *after* a token is
issued — verification, ownership guards, per-user scoping, the 14 tools, the
audit log — stays exactly as it is today.

```
                          ┌─────────────────────────────────────┐
   TODAY (API tokens):    │ user clicks "Create token"          │
                          │        ↓                            │
                          │  issueToken() → rq_mcp_…            │──┐
                          └─────────────────────────────────────┘  │
                                                                    │   SAME
                          ┌─────────────────────────────────────┐  │  DOWNSTREAM
   NEW (OAuth):           │ Claude → /authorize → consent →     │  │   PATH
                          │ /token → access token               │──┤   (unchanged)
                          └─────────────────────────────────────┘  │
                                                                    ▼
                                       verifyToken() → guards → tools → data
```

So this plan is almost entirely **new endpoints in front of the existing
machinery** — not a rewrite of it. That is why it's ~5 days, not ~3 weeks.

---

## 1. What the user experiences

**Today**
1. Open Connect page → Create token → copy
2. Paste token into Claude Desktop config
3. Restart

**After OAuth**
1. In Claude: Settings → Connectors → Add → paste `https://…/api/mcp`
2. A browser window opens: *"Requisor — Allow Claude to read your meetings and
   themes? [Approve] [Deny]"*
3. Click Approve. Done.

If they're not already logged into Requisor, step 2 shows the normal login page
first, then the consent screen. We reuse the existing session auth for this —
no new login system.

---

## 2. What the MCP spec actually requires

MCP's authorization spec builds on standard OAuth 2.1 RFCs. A compliant client
(Claude Desktop, Claude web, Cursor) will:

1. Hit the MCP endpoint with no token → expects a **401 with a
   `WWW-Authenticate` header** pointing at protected-resource metadata.
2. Fetch **Protected Resource Metadata** (RFC 9728) →
   `/.well-known/oauth-protected-resource` → learns which authorization server
   to use.
3. Fetch **Authorization Server Metadata** (RFC 8414) →
   `/.well-known/oauth-authorization-server` → learns the `/authorize`,
   `/token`, `/register` URLs.
4. **Register itself** (RFC 7591 Dynamic Client Registration) → `POST /register`
   → gets a `client_id`.
5. Open a browser to **`/authorize`** with **PKCE** (RFC 7636) → user approves →
   gets an authorization `code`.
6. Exchange the code at **`/token`** → gets an `access_token` (+ `refresh_token`).
7. Call the MCP endpoint with `Authorization: Bearer <access_token>`.

We must implement each numbered piece. The good news: steps 1 and 7 already
work — we return the right 401 and we already verify bearer tokens.

---

## 3. New endpoints

All under `/api/mcp/oauth/*` except the two well-known paths (which must sit at
the domain root per spec).

| Endpoint | RFC | Job |
|---|---|---|
| `GET /.well-known/oauth-protected-resource` | 9728 | Point clients at our auth server. **Replaces the current 404 stub.** |
| `GET /.well-known/oauth-authorization-server` | 8414 | Advertise our authorize/token/register URLs + PKCE support. **Replaces the current 404 stub.** |
| `POST /api/mcp/oauth/register` | 7591 | Dynamic client registration → issue a `client_id`. |
| `GET /api/mcp/oauth/authorize` | 6749 | The consent screen. Reuses existing session login. |
| `POST /api/mcp/oauth/authorize` | 6749 | Handle Approve/Deny → issue an authorization code. |
| `POST /api/mcp/oauth/token` | 6749 | Exchange code → access token; also refresh-token grant. |

The current stub handlers in `server/index.ts` (lines ~360, returning
`not_supported`) get **replaced** — the plumbing to swap them is already there.

---

## 4. New database tables

Three, all created via direct SQL (same pattern as `create-mcp-tables.sql`),
never `db:push`.

### `oauth_clients` — registered MCP clients
| Column | Notes |
|---|---|
| `client_id` (PK) | random, public |
| `client_name` | e.g. "Claude" — from registration |
| `redirect_uris` (jsonb) | where the browser returns after approval |
| `created_at` | |

Public clients (PKCE), so **no client secret** — that's the OAuth 2.1 default
for apps that can't keep one.

### `oauth_auth_codes` — short-lived authorization codes
| Column | Notes |
|---|---|
| `code` (PK, hashed) | one-time, ~60s TTL |
| `client_id`, `user_id` | who approved for whom |
| `redirect_uri` | must match on exchange |
| `code_challenge`, `code_challenge_method` | PKCE — verified at `/token` |
| `scope` | `read` for now |
| `expires_at`, `consumed_at` | single-use enforcement |

### `oauth_access_grants` — issued tokens
Effectively the OAuth-issued equivalent of `user_api_tokens`. Cleanest path:
**add columns to the existing `user_api_tokens` table** rather than a new one, so
`verifyToken()` and the audit log work unchanged.

| Added column | Notes |
|---|---|
| `origin` | `'manual'` \| `'oauth'` — so the UI can label them |
| `client_id` | null for manual tokens |
| `refresh_token_hash` | null for manual tokens |

This is the key reuse: an OAuth access token **is** a `user_api_tokens` row.
Everything downstream already handles it.

---

## 5. The security-critical pieces

These are where OAuth implementations go wrong. Each gets explicit attention.

1. **PKCE is mandatory.** Store `code_challenge` at `/authorize`, verify the
   `code_verifier` at `/token`. Without it, a stolen auth code is replayable.
2. **Authorization codes are single-use and short-lived** (~60s, `consumed_at`
   set atomically). A code exchanged twice must fail.
3. **Redirect URI exact-match.** The `redirect_uri` at `/token` must byte-match
   the one from `/authorize`. This is the classic open-redirect / token-theft
   hole.
4. **The consent screen is a real gate.** It runs behind `isAuthenticated`; an
   unauthenticated user is bounced to the existing login first. Approval is per
   user, per client, and recorded.
5. **Resource binding (RFC 8707).** Tokens are minted for *this* MCP server, so
   a token can't be replayed against a different resource.
6. **Reuse the hashing discipline we already have.** Codes and refresh tokens
   stored as SHA-256, looked up by prefix, compared with `timingSafeEqualStr` —
   identical to `api-tokens.ts`.

---

## 6. What we reuse vs. build

**Reuse (no change):**
- Session auth (`isAuthenticated`) → gates the consent screen
- `verifyToken()` → validates OAuth access tokens unchanged
- All 14 tools, guards, pagination, `runWithAiContext`, audit log
- The token-hashing helpers in `api-tokens.ts`

**Build new:**
- 6 endpoints (section 3)
- 2–3 tables / column additions (section 4)
- 1 consent screen (a small React page + a server-rendered fallback)
- OAuth service module (`server/mcp/oauth.ts`) — code issue/verify, PKCE, token exchange

---

## 7. Milestones

| # | Deliverable | Est. |
|---|---|---|
| O1 | Tables + `oauth.ts` service (client reg, code issue/verify, PKCE, token mint) | 1.0d |
| O2 | Discovery: replace the two well-known stubs with real metadata; wire the 401 `WWW-Authenticate` to point at them | 0.5d |
| O3 | `/register` (dynamic client registration) | 0.5d |
| O4 | `/authorize` GET+POST — consent screen, session-gated, issues code | 1.0d |
| O5 | `/token` — code exchange + PKCE verify + refresh grant | 1.0d |
| O6 | Connect page: "Connected apps" list (OAuth grants), revoke, label `via OAuth` | 0.5d |
| O7 | End-to-end test with the MCP Inspector + real Claude Desktop; security pass | 0.5d |

**≈ 5 developer-days.**

---

## 8. Verification (must pass before merge)

1. **Full flow** — Claude Desktop "Add connector" → browser consent → tools
   appear, with **no token ever copied by the user**.
2. **PKCE enforced** — a `/token` exchange with a wrong `code_verifier` is
   rejected.
3. **Code replay blocked** — the same authorization code exchanged twice fails
   the second time.
4. **Redirect-URI tamper blocked** — a mismatched `redirect_uri` at `/token` is
   rejected.
5. **Consent required** — approving as user A never yields a token that reads
   user B's data (the existing guard test, over an OAuth token).
6. **Revoke works** — revoking a connected app in the Connect page kills its
   access on the next request.
7. **API tokens still work** — the manual-token path is untouched and continues
   to function alongside OAuth.

---

## 9. What ships, and what we tell users

Both auth methods coexist:

- **OAuth** — the default, one-click path for Claude/Cursor.
- **API tokens** — kept for scripts, generic HTTP clients, and anything without
  an OAuth flow.

The Connect page gains a "Connected apps" section (OAuth grants) alongside the
existing "Access tokens" section.

---

## 10. Risks & non-goals

- **Scope creep into full OIDC.** We are doing OAuth 2.1 for authorization only,
  not identity/OpenID Connect. `/.well-known/openid-configuration` stays a 404.
- **Refresh-token rotation.** v1 issues refresh tokens; rotation-on-use is a
  fast-follow, not a blocker.
- **Client trust.** Dynamic registration accepts any client. That's per spec —
  the consent screen is the actual gate, not registration.
- **This does not change what the AI can read.** Still read-only, still the same
  14 tools, still per-user scoped. OAuth changes *how you connect*, nothing else.

---

## Open questions for you

1. **Plan-gate it?** Should OAuth (or MCP at all) require a paid tier?
2. **Consent screen** — server-rendered (simplest, works before the SPA loads)
   or a React page under `/connect/authorize`? I lean server-rendered for
   reliability.
3. **Keep API tokens?** I strongly recommend yes — they're the fallback for
   non-OAuth clients. Confirm.
