/**
 * OAuth 2.1 HTTP endpoints for the MCP authorization flow.
 *
 * Discovery metadata is served from the domain root (mounted separately in
 * server/index.ts); everything else lives under /api/mcp/oauth.
 *
 * The consent screen is server-rendered on purpose: it must work before any
 * SPA JavaScript loads, in a browser window the MCP client just popped open,
 * possibly with no Requisor session yet. A self-contained HTML page with an
 * inline sign-in form is the most reliable option and needs no client changes.
 */

import express, { type Request, type Response, type Router } from "express";
import { z } from "zod";
import {
  registerClient,
  getClient,
  redirectUriMatches,
  issueAuthCode,
  consumeAuthCode,
} from "./oauth";
import { issueOAuthToken, rotateAccessToken } from "../services/api-tokens";

function currentUserId(req: any): string | undefined {
  return req.user?.dbUserId || req.user?.claims?.sub;
}

/** Absolute base URL of this deployment, derived from the request. */
export function baseUrl(req: Request): string {
  // Honour the proxy Replit sits behind (trust proxy is enabled in index.ts).
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Discovery metadata (RFC 8414 + RFC 9728)
// ─────────────────────────────────────────────────────────────────────────

/** Authorization Server Metadata — advertises our endpoints + PKCE support. */
export function authorizationServerMetadata(req: Request, res: Response): void {
  const base = baseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/api/mcp/oauth/authorize`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    registration_endpoint: `${base}/api/mcp/oauth/register`,
    scopes_supported: ["read"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"], // public clients (PKCE)
    code_challenge_methods_supported: ["S256"],
  });
}

/** Protected Resource Metadata — points clients at the auth server above. */
export function protectedResourceMetadata(req: Request, res: Response): void {
  const base = baseUrl(req);
  res.json({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: ["read"],
    bearer_methods_supported: ["header"],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Consent screen (server-rendered)
// ─────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    background:#f8fafc; color:#0f172a; display:flex; min-height:100vh;
    align-items:center; justify-content:center; padding:24px; }
  @media (prefers-color-scheme: dark){ body{ background:#0f172a; color:#e2e8f0 } .card{ background:#1e293b !important; border-color:#334155 !important } input{ background:#0f172a !important; color:#e2e8f0 !important; border-color:#334155 !important } }
  .card { background:#fff; border:1px solid #e2e8f0; border-radius:16px;
    padding:32px; width:100%; max-width:420px; box-shadow:0 10px 40px rgba(0,0,0,.08); }
  .logo { width:44px;height:44px;border-radius:12px;background:#7c3aed;display:flex;
    align-items:center;justify-content:center;margin-bottom:20px;font-size:22px }
  h1 { font-size:20px; margin:0 0 8px }
  p { color:#64748b; font-size:14px; line-height:1.5; margin:0 0 20px }
  .scope { background:#f1f5f9; border-radius:10px; padding:12px 14px; font-size:13px; margin-bottom:20px }
  @media (prefers-color-scheme: dark){ .scope{ background:#0f172a } }
  .scope b { color:inherit }
  label { display:block; font-size:13px; font-weight:600; margin:12px 0 6px }
  input { width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px }
  .row { display:flex; gap:10px; margin-top:20px }
  button { flex:1; padding:11px; border-radius:10px; border:0; font-size:14px; font-weight:600; cursor:pointer }
  .approve { background:#7c3aed; color:#fff }
  .approve:hover { background:#6d28d9 }
  .deny { background:#f1f5f9; color:#334155 }
  @media (prefers-color-scheme: dark){ .deny{ background:#334155; color:#e2e8f0 } }
  .err { color:#dc2626; font-size:13px; margin-top:10px; min-height:18px }
  .muted { font-size:12px; color:#94a3b8; margin-top:16px; text-align:center }
</style></head><body><div class="card">${body}</div></body></html>`;
}

/** The Approve/Deny view, shown once the user has a session. */
function consentView(opts: {
  clientName: string;
  params: Record<string, string>;
}): string {
  const hidden = Object.entries(opts.params)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return page(
    "Connect to Requisor",
    `<div class="logo">🔌</div>
     <h1>Connect ${esc(opts.clientName)}</h1>
     <p><b>${esc(opts.clientName)}</b> wants to connect to your Requisor account.</p>
     <div class="scope">This will let it <b>read</b>:
       <br>• your meetings and transcripts
       <br>• meeting minutes and action items
       <br>• your customer themes and quotes
       <br><br>It <b>cannot</b> create, edit or delete anything.</div>
     <form method="POST" action="/api/mcp/oauth/authorize">
       ${hidden}
       <div class="row">
         <button class="deny" name="decision" value="deny" type="submit">Deny</button>
         <button class="approve" name="decision" value="approve" type="submit">Approve</button>
       </div>
     </form>
     <div class="muted">You can revoke this anytime from Requisor → Connect.</div>`,
  );
}

/** The inline sign-in view, shown when there's no session yet. */
function loginView(opts: { params: Record<string, string>; error?: string }): string {
  const qs = new URLSearchParams(opts.params).toString();
  return page(
    "Sign in to Requisor",
    `<div class="logo">🔌</div>
     <h1>Sign in to Requisor</h1>
     <p>Sign in to authorize the connection.</p>
     <form id="f">
       <label>Email</label>
       <input type="email" id="email" autocomplete="username" required>
       <label>Password</label>
       <input type="password" id="password" autocomplete="current-password" required>
       <div class="err" id="err">${opts.error ? esc(opts.error) : ""}</div>
       <div class="row"><button class="approve" type="submit">Sign in</button></div>
     </form>
     <script>
       const f = document.getElementById('f');
       f.addEventListener('submit', async (e) => {
         e.preventDefault();
         document.getElementById('err').textContent = '';
         const email = document.getElementById('email').value;
         const password = document.getElementById('password').value;
         try {
           const r = await fetch('/api/auth/login', {
             method:'POST', headers:{'Content-Type':'application/json'},
             credentials:'include', body: JSON.stringify({ email, password })
           });
           if (r.ok) { window.location.href = '/api/mcp/oauth/authorize?' + ${JSON.stringify(qs)}; }
           else { const j = await r.json().catch(()=>({})); document.getElementById('err').textContent = j.message || 'Sign in failed'; }
         } catch { document.getElementById('err').textContent = 'Sign in failed'; }
       });
     </script>`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────

const authorizeQuery = z.object({
  response_type: z.string(),
  client_id: z.string(),
  redirect_uri: z.string(),
  code_challenge: z.string(),
  code_challenge_method: z.string().optional(),
  scope: z.string().optional(),
  state: z.string().optional(),
  resource: z.string().optional(),
});

export function createOAuthRouter(): Router {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false }));

  // ── Dynamic client registration (RFC 7591) ────────────────────────────
  //
  // The response MUST be a complete client-information response. An earlier,
  // sparser version omitted client_id_issued_at, client_secret_expires_at and
  // did not echo response_types — and a client library that considers a
  // registration response incomplete RETRIES, creating a second client. That
  // duplicate registration is what stranded the token exchange (the callback
  // session bound to one client_id, the code issued under another). Returning
  // the full, spec-shaped body lets the client register exactly once.
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const redirectUris: string[] = Array.isArray(req.body?.redirect_uris)
        ? req.body.redirect_uris
        : [];
      const client = await registerClient({
        clientName: req.body?.client_name,
        redirectUris,
      });

      // Trace log — lets you follow the OAuth flow in the deploy logs and see
      // exactly which step a client reaches (register → authorize → token).
      console.log(
        `[oauth] REGISTER  client=${client.clientId} name=${client.clientName ?? "?"} ` +
          `redirects=${JSON.stringify(client.redirectUris)}`,
      );

      const issuedAt = Math.floor(Date.now() / 1000);
      res.status(201).json({
        client_id: client.clientId,
        client_id_issued_at: issuedAt,
        // Public client (PKCE) — no secret. RFC 7591 uses 0 to mean "no
        // secret / never expires"; some client libraries require the field
        // to be present at all.
        client_secret_expires_at: 0,
        client_name: client.clientName ?? "MCP Client",
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "read",
      });
    } catch (err: any) {
      res.status(400).json({ error: "invalid_client_metadata", error_description: err?.message });
    }
  });

  // ── Authorization endpoint — GET renders consent (or sign-in) ──────────
  router.get("/authorize", async (req: any, res: Response) => {
    const parsed = authorizeQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).send(page("Error", "<h1>Invalid request</h1><p>Missing or malformed authorization parameters.</p>"));
    }
    const q = parsed.data;

    if (q.response_type !== "code") {
      return redirectError(res, q.redirect_uri, "unsupported_response_type", q.state);
    }
    if ((q.code_challenge_method || "S256") !== "S256") {
      return redirectError(res, q.redirect_uri, "invalid_request", q.state, "PKCE S256 required");
    }

    const client = await getClient(q.client_id);
    if (!client) {
      return res.status(400).send(page("Error", "<h1>Unknown client</h1><p>This application is not registered.</p>"));
    }
    // Redirect-URI exact match is the critical anti-exfiltration check.
    if (!redirectUriMatches(client, q.redirect_uri)) {
      return res.status(400).send(page("Error", "<h1>Invalid redirect</h1><p>The redirect URI does not match this client's registration.</p>"));
    }

    const params = {
      response_type: q.response_type,
      client_id: q.client_id,
      redirect_uri: q.redirect_uri,
      code_challenge: q.code_challenge,
      code_challenge_method: q.code_challenge_method || "S256",
      scope: q.scope || "read",
      state: q.state || "",
      resource: q.resource || "",
    };

    // No session → show the inline sign-in form (same params carried through).
    if (!currentUserId(req)) {
      return res.status(200).send(loginView({ params }));
    }
    res.status(200).send(consentView({ clientName: client.clientName || "This application", params }));
  });

  // ── Authorization endpoint — POST handles Approve/Deny ─────────────────
  router.post("/authorize", async (req: any, res: Response) => {
    const b = req.body || {};
    const userId = currentUserId(req);

    // Session could have lapsed between render and submit — re-gate.
    if (!userId) {
      return res.status(401).send(page("Session expired", "<h1>Session expired</h1><p>Please start the connection again.</p>"));
    }

    const redirectUri = String(b.redirect_uri || "");
    const state = b.state ? String(b.state) : undefined;

    if (b.decision !== "approve") {
      return redirectError(res, redirectUri, "access_denied", state, "User denied the request");
    }

    const client = await getClient(String(b.client_id || ""));
    if (!client || !redirectUriMatches(client, redirectUri)) {
      return res.status(400).send(page("Error", "<h1>Invalid request</h1>"));
    }

    const code = await issueAuthCode({
      clientId: client.clientId,
      userId,
      redirectUri,
      codeChallenge: String(b.code_challenge || ""),
      codeChallengeMethod: String(b.code_challenge_method || "S256"),
      scope: String(b.scope || "read"),
      resource: b.resource ? String(b.resource) : undefined,
    });

    // Trace: code issued and redirected. If the deploy log shows this line but
    // NO "[oauth] TOKEN" line follows, the client never came back to exchange
    // the code — the failure is on the client side, after our redirect.
    console.log(
      `[oauth] APPROVE   client=${client.clientId} code issued, redirecting to ${new URL(redirectUri).host}`,
    );

    const url = new URL(redirectUri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    res.redirect(url.toString());
  });

  // ── Token endpoint — code exchange + refresh (RFC 6749) ────────────────
  router.post("/token", async (req: Request, res: Response) => {
    const grant = String(req.body?.grant_type || "");
    // Trace: the client DID come back to exchange. Its mere presence answers
    // "does the client call /token?" — the crux of the whole investigation.
    console.log(
      `[oauth] TOKEN     grant=${grant} client=${req.body?.client_id ?? "?"} ` +
        `has_code=${!!req.body?.code} has_verifier=${!!req.body?.code_verifier}`,
    );

    if (grant === "authorization_code") {
      const consumed = await consumeAuthCode({
        code: String(req.body?.code || ""),
        clientId: String(req.body?.client_id || ""),
        redirectUri: String(req.body?.redirect_uri || ""),
        codeVerifier: String(req.body?.code_verifier || ""),
      });
      if (!consumed) {
        console.log(`[oauth] TOKEN     REJECTED invalid_grant (code/PKCE/redirect mismatch)`);
        return res.status(400).json({ error: "invalid_grant" });
      }
      console.log(`[oauth] TOKEN     OK access token issued for user=${consumed.userId}`);
      const client = await getClient(consumed.clientId);
      const issued = await issueOAuthToken({
        userId: consumed.userId,
        clientId: consumed.clientId,
        clientName: client?.clientName ?? null,
        scopes: ["read"],
      });
      return res.json({
        access_token: issued.accessToken,
        token_type: "Bearer",
        expires_in: issued.expiresInSeconds,
        refresh_token: issued.refreshToken,
        scope: consumed.scope,
      });
    }

    if (grant === "refresh_token") {
      const rotated = await rotateAccessToken(
        String(req.body?.refresh_token || ""),
        String(req.body?.client_id || ""),
      );
      if (!rotated) {
        return res.status(400).json({ error: "invalid_grant" });
      }
      return res.json({
        access_token: rotated.accessToken,
        token_type: "Bearer",
        expires_in: rotated.expiresInSeconds,
        refresh_token: rotated.refreshToken,
        scope: "read",
      });
    }

    res.status(400).json({ error: "unsupported_grant_type" });
  });

  return router;
}

/** Redirect an OAuth error back to the client per RFC 6749 §4.1.2.1. */
function redirectError(
  res: Response,
  redirectUri: string,
  error: string,
  state?: string,
  description?: string,
): void {
  try {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    if (description) url.searchParams.set("error_description", description);
    if (state) url.searchParams.set("state", state);
    res.redirect(url.toString());
  } catch {
    res.status(400).json({ error, error_description: description });
  }
}
