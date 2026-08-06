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

// Requisor dino logo, resized to 96px and embedded so the consent page stays
// self-contained (no external request, works before anything else loads).
const DINO_LOGO =
  "data:image/png;base64,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";

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
  /* Requisor brand: emerald green (#10b981 / hover #059669) — matches the app. */
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    background:#f0fdf4; color:#0f172a; display:flex; min-height:100vh;
    align-items:center; justify-content:center; padding:24px;
    background-image: radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,.12), transparent); }
  @media (prefers-color-scheme: dark){ body{ background:#0b1220; color:#e2e8f0; background-image: radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,.14), transparent); } .card{ background:#111c2e !important; border-color:#1e3a34 !important } input{ background:#0b1220 !important; color:#e2e8f0 !important; border-color:#334155 !important } }
  .card { background:#fff; border:1px solid #d1fae5; border-radius:18px;
    padding:32px; width:100%; max-width:420px; box-shadow:0 12px 44px rgba(16,185,129,.14); }
  .logo { width:48px;height:48px;border-radius:14px; object-fit:contain; padding:5px;
    background:linear-gradient(135deg,#10b981,#059669); margin-bottom:20px;
    box-shadow:0 6px 18px rgba(16,185,129,.35) }
  h1 { font-size:20px; margin:0 0 8px; letter-spacing:-.01em }
  p { color:#64748b; font-size:14px; line-height:1.5; margin:0 0 20px }
  strong, b { color:#059669 }
  @media (prefers-color-scheme: dark){ strong, b { color:#34d399 } }
  .scope { background:#f0fdf4; border:1px solid #d1fae5; border-radius:12px; padding:14px; font-size:13px; margin-bottom:20px; line-height:1.7 }
  @media (prefers-color-scheme: dark){ .scope{ background:#0d1f19; border-color:#1e3a34 } }
  label { display:block; font-size:13px; font-weight:600; margin:12px 0 6px }
  input { width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px; outline:none }
  input:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.18) }
  .row { display:flex; gap:10px; margin-top:20px }
  button { flex:1; padding:12px; border-radius:11px; border:0; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s, transform .05s }
  button:active { transform:translateY(1px) }
  .approve { background:#10b981; color:#fff; box-shadow:0 4px 14px rgba(16,185,129,.35) }
  .approve:hover { background:#059669 }
  .deny { background:#f1f5f9; color:#334155 }
  .deny:hover { background:#e2e8f0 }
  @media (prefers-color-scheme: dark){ .deny{ background:#1e293b; color:#e2e8f0 } .deny:hover{ background:#334155 } }
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
    `<img class="logo" src="${DINO_LOGO}" alt="Requisor">
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
    `<img class="logo" src="${DINO_LOGO}" alt="Requisor">
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
