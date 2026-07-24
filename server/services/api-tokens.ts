/**
 * MCP access tokens — issue, verify, list, revoke.
 *
 * These are the credentials an external MCP client (Claude Desktop, Claude
 * Code, Cursor) presents to act as one Requisor user. They are deliberately
 * NOT handled the way BYOK provider keys are:
 *
 *   user_ai_settings keys  → AES-256-GCM, because they must be *decrypted*
 *                            and forwarded to Anthropic/OpenAI.
 *   user_api_tokens        → SHA-256 hash, because they only ever need to be
 *                            *verified*. Nothing is stored that an attacker
 *                            could replay if the database leaked.
 *
 * Token format:  rq_mcp_<8-char prefix>_<43-char base64url secret>
 *
 * The prefix is non-secret and indexed, so verification is one row fetch plus
 * a constant-time comparison rather than a table scan over every token.
 */

import crypto from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { userApiTokens, type UserApiToken } from "@shared/schema";
import { timingSafeEqualStr } from "../security/helpers";

const TOKEN_NAMESPACE = "rq_mcp";
const PREFIX_LENGTH = 8;

export type McpScope = "read" | "write";

/** What a verified token resolves to. Everything downstream keys off this. */
export interface McpPrincipal {
  userId: string;
  tokenId: number;
  scopes: McpScope[];
}

/** Safe projection — never includes the secret or its hash. */
export interface SafeApiToken {
  id: number;
  name: string;
  last4: string;
  scopes: McpScope[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function toSafe(row: UserApiToken): SafeApiToken {
  return {
    id: row.id,
    name: row.name,
    last4: row.last4,
    scopes: normaliseScopes(row.scopes),
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

/**
 * `scopes` is a jsonb column, so it arrives as `unknown`. Coerce defensively —
 * a malformed value must degrade to read-only, never to write.
 */
function normaliseScopes(raw: unknown): McpScope[] {
  if (!Array.isArray(raw)) return ["read"];
  const out = raw.filter((s): s is McpScope => s === "read" || s === "write");
  return out.length ? out : ["read"];
}

// ─────────────────────────────────────────────────────────────────────────
// Issue
// ─────────────────────────────────────────────────────────────────────────

export interface IssueTokenInput {
  userId: string;
  name: string;
  scopes?: McpScope[];
  /** Days until expiry. Omit for a non-expiring token. */
  expiresInDays?: number;
}

export interface IssuedToken {
  /** Plaintext. Returned exactly once, never recoverable afterwards. */
  token: string;
  record: SafeApiToken;
}

export async function issueToken(input: IssueTokenInput): Promise<IssuedToken> {
  const name = input.name?.trim();
  if (!name) throw new Error("Token name is required");
  if (name.length > 100) throw new Error("Token name is too long (max 100)");

  const prefix = crypto.randomBytes(6).toString("base64url").slice(0, PREFIX_LENGTH);
  const secret = crypto.randomBytes(32).toString("base64url");
  const token = `${TOKEN_NAMESPACE}_${prefix}_${secret}`;

  const expiresAt =
    typeof input.expiresInDays === "number" && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const [row] = await db
    .insert(userApiTokens)
    .values({
      userId: input.userId,
      name,
      tokenPrefix: prefix,
      tokenHash: sha256Hex(token),
      last4: secret.slice(-4),
      scopes: normaliseScopes(input.scopes ?? ["read"]),
      expiresAt,
    })
    .returning();

  return { token, record: toSafe(row) };
}

// ─────────────────────────────────────────────────────────────────────────
// Verify
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve a raw bearer token to its principal, or null when it is malformed,
 * unknown, revoked, or expired.
 *
 * Fails closed on every ambiguity — an unparseable token is simply not a
 * token, and no partial match ever grants access.
 */
export async function verifyToken(raw: string | undefined): Promise<McpPrincipal | null> {
  if (!raw) return null;

  // Parse POSITIONALLY, not by splitting on "_".
  //
  // The secret is base64url, whose alphabet includes "_" — so roughly half of
  // all generated tokens contain one. Splitting on "_" and demanding exactly
  // four parts silently rejected those tokens forever, no matter how many
  // times the user regenerated. Layout is fixed, so slice it:
  //
  //   rq_mcp_ | <8-char prefix> | _ | <secret, any base64url chars>
  const marker = `${TOKEN_NAMESPACE}_`; // "rq_mcp_"
  if (!raw.startsWith(marker)) return null;

  const rest = raw.slice(marker.length);
  if (rest.length < PREFIX_LENGTH + 2) return null;
  if (rest[PREFIX_LENGTH] !== "_") return null;

  const prefix = rest.slice(0, PREFIX_LENGTH);
  const secret = rest.slice(PREFIX_LENGTH + 1);
  if (!prefix || !secret) return null;

  const candidates = await db
    .select()
    .from(userApiTokens)
    .where(and(eq(userApiTokens.tokenPrefix, prefix), isNull(userApiTokens.revokedAt)));

  const incomingHash = sha256Hex(raw);

  for (const row of candidates) {
    // Constant-time — a prefix collision must not become a timing oracle.
    if (!timingSafeEqualStr(row.tokenHash, incomingHash)) continue;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

    return {
      userId: row.userId,
      tokenId: row.id,
      scopes: normaliseScopes(row.scopes),
    };
  }

  return null;
}

/**
 * Record that a token was used. Fire-and-forget: a failure here must never
 * fail the request that triggered it.
 */
export function touchToken(tokenId: number): void {
  db.update(userApiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiTokens.id, tokenId))
    .catch((err) => {
      console.warn("[api-tokens] failed to record token use:", err?.message || err);
    });
}

// ─────────────────────────────────────────────────────────────────────────
// List / revoke
// ─────────────────────────────────────────────────────────────────────────

export async function listTokens(userId: string): Promise<SafeApiToken[]> {
  const rows = await db
    .select()
    .from(userApiTokens)
    .where(and(eq(userApiTokens.userId, userId), isNull(userApiTokens.revokedAt)))
    .orderBy(desc(userApiTokens.createdAt));
  return rows.map(toSafe);
}

/**
 * Soft-revoke. Scoped by userId so one user can never revoke another's token
 * by guessing an id.
 */
export async function revokeToken(userId: string, tokenId: number): Promise<boolean> {
  const rows = await db
    .update(userApiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userApiTokens.id, tokenId),
        eq(userApiTokens.userId, userId),
        isNull(userApiTokens.revokedAt),
      ),
    )
    .returning();
  return rows.length > 0;
}
