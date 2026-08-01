/**
 * OAuth 2.1 authorization server for the MCP endpoint.
 *
 * Implements just enough of the spec for MCP's one-click connect:
 *   - Dynamic client registration (RFC 7591)
 *   - Authorization codes with PKCE (RFC 6749 §4.1 + RFC 7636)
 *   - Token exchange + refresh (RFC 6749)
 *
 * This module is the credential-minting layer ONLY. Once it hands back an
 * access token, that token is an ordinary user_api_tokens row and everything
 * downstream — verifyToken, guards, tools, audit log — is unchanged.
 *
 * Security posture mirrors api-tokens.ts: codes and refresh tokens are stored
 * as SHA-256 hashes, looked up by hash, and every ambiguity fails closed.
 */

import crypto from "crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "../db";
import { oauthClients, oauthAuthCodes } from "@shared/schema";

const AUTH_CODE_TTL_MS = 60_000; // 60s — codes are exchanged immediately

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────
// Client registration (RFC 7591)
// ─────────────────────────────────────────────────────────────────────────

export interface RegisteredClient {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
}

/**
 * Register a public client. Per spec, dynamic registration is open — the
 * consent screen is the gate, not the client's identity. We validate only
 * that at least one usable redirect URI was supplied.
 */
export async function registerClient(input: {
  clientName?: string;
  redirectUris: string[];
}): Promise<RegisteredClient> {
  const redirectUris = (input.redirectUris || []).filter(
    (u) => typeof u === "string" && isAllowedRedirect(u),
  );
  if (redirectUris.length === 0) {
    throw new Error("At least one valid redirect_uri is required");
  }

  const clientId = `mcp_${crypto.randomBytes(16).toString("hex")}`;

  const [row] = await db
    .insert(oauthClients)
    .values({
      clientId,
      clientName: input.clientName?.slice(0, 200) ?? null,
      redirectUris,
    })
    .returning();

  return {
    clientId: row.clientId,
    clientName: row.clientName,
    redirectUris: row.redirectUris as string[],
  };
}

export async function getClient(clientId: string): Promise<RegisteredClient | null> {
  if (!clientId) return null;
  const rows = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    clientId: row.clientId,
    clientName: row.clientName,
    redirectUris: row.redirectUris as string[],
  };
}

/**
 * Redirect-URI allowlist. MCP clients use one of:
 *   - loopback (Claude Desktop / Cursor spawn a local listener)
 *   - an https URL (hosted clients like claude.ai)
 * Allowed:
 *   - https to anywhere (hosted clients like claude.ai)
 *   - http ONLY to loopback (127.0.0.1 / localhost / [::1]) — the MCP Inspector
 *     and native apps that spin up a local listener
 *   - custom private-use schemes (cursor://, vscode://, …) — how native MCP
 *     clients receive the callback, per RFC 8252 §7.1
 *
 * Refused: http to a non-loopback host (the classic plaintext-exfiltration
 * hole) and known code-execution schemes. Custom schemes are safe here because
 * the consent screen, exact redirect-URI matching, and mandatory PKCE are the
 * real protections — not the scheme allowlist.
 */
const DANGEROUS_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:"]);

export function isAllowedRedirect(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (DANGEROUS_SCHEMES.has(u.protocol)) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") {
    return (
      u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]"
    );
  }
  // Custom private-use scheme from a native client (cursor://, vscode://, …).
  // Require an actual scheme so a malformed value can't slip through.
  return /^[a-z][a-z0-9+.-]*:$/i.test(u.protocol);
}

/** Exact match — never prefix or startsWith, which would be exploitable. */
export function redirectUriMatches(client: RegisteredClient, uri: string): boolean {
  return client.redirectUris.includes(uri);
}

// ─────────────────────────────────────────────────────────────────────────
// Authorization codes (RFC 6749 §4.1 + PKCE RFC 7636)
// ─────────────────────────────────────────────────────────────────────────

export interface IssueCodeInput {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  resource?: string;
}

/** Issue a one-time code. Returns the RAW code (goes in the redirect only). */
export async function issueAuthCode(input: IssueCodeInput): Promise<string> {
  const code = crypto.randomBytes(32).toString("base64url");
  await db.insert(oauthAuthCodes).values({
    codeHash: sha256Hex(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod || "S256",
    scope: input.scope || "read",
    resource: input.resource ?? null,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });
  return code;
}

export interface ConsumedCode {
  userId: string;
  clientId: string;
  scope: string;
  resource: string | null;
}

/**
 * Validate and consume an authorization code at the token endpoint.
 *
 * Enforces, in order: code exists → not expired → not already used →
 * client matches → redirect_uri matches → PKCE verifier matches. The row is
 * marked consumed atomically so a concurrent second exchange loses the race.
 *
 * Returns null on any failure — the caller maps that to invalid_grant.
 */
export async function consumeAuthCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<ConsumedCode | null> {
  if (!input.code || !input.codeVerifier) return null;

  const rows = await db
    .select()
    .from(oauthAuthCodes)
    .where(and(eq(oauthAuthCodes.codeHash, sha256Hex(input.code)), isNull(oauthAuthCodes.consumedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.clientId !== input.clientId) return null;
  if (row.redirectUri !== input.redirectUri) return null;

  // PKCE: BASE64URL(SHA256(verifier)) must equal the stored challenge.
  if (!verifyPkce(input.codeVerifier, row.codeChallenge, row.codeChallengeMethod)) {
    return null;
  }

  // Atomic single-use: only the first UPDATE that flips consumed_at wins.
  const claimed = await db
    .update(oauthAuthCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(oauthAuthCodes.id, row.id), isNull(oauthAuthCodes.consumedAt)))
    .returning();
  if (claimed.length === 0) return null; // lost the race

  return {
    userId: row.userId,
    clientId: row.clientId,
    scope: row.scope,
    resource: row.resource,
  };
}

/** RFC 7636 verification. We require S256; "plain" is refused as too weak. */
export function verifyPkce(verifier: string, challenge: string, method: string): boolean {
  if (method !== "S256") return false;
  const computed = crypto.createHash("sha256").update(verifier).digest("base64url");
  // Constant-time compare; lengths are fixed so a length mismatch is a plain no.
  if (computed.length !== challenge.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
}

/** Housekeeping — drop expired, unconsumed codes. Safe to call periodically. */
export async function purgeExpiredCodes(): Promise<void> {
  await db.delete(oauthAuthCodes).where(lt(oauthAuthCodes.expiresAt, new Date()));
}
