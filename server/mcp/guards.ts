/**
 * Access guards and result-shaping helpers for MCP tools.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Requisor's single-row getters take a bare numeric id and perform NO
 * ownership check:
 *
 *   storage.getTheme(id)              → any user's theme
 *   storage.getZoomMeeting(id)        → any user's meeting
 *   storage.getTeamsMeeting(id)       → any user's meeting
 *   storage.getGoogleMeetMeeting(id)  → any user's meeting
 *   storage.getConversation(id)       → any user's conversation
 *
 * Inside Express that is safe by accident: every route re-checks
 * `row.userId !== userId` by hand before responding. An MCP tool has no such
 * shield — the id arrives straight from a model, which may have guessed it.
 *
 * So every tool that resolves an id goes through this file. Nothing else.
 */

import { storage } from "../storage";
import type { McpPrincipal, McpScope } from "../services/api-tokens";

// ─────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a tool is denied. Caught at the tool boundary and rendered as
 * `isError: true` content rather than a protocol error, so the model can
 * explain the refusal to the user instead of the connection dropping.
 */
export class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolError";
  }
}

export function requireScope(principal: McpPrincipal, scope: McpScope): void {
  if (!principal.scopes.includes(scope)) {
    throw new McpToolError(
      `This token does not have '${scope}' permission. Generate a token with ` +
        `'${scope}' scope in Requisor → Settings → MCP Access.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Meetings
// ─────────────────────────────────────────────────────────────────────────

export const MEETING_SOURCES = ["zoom", "google_meet", "teams"] as const;
export type MeetingSource = (typeof MEETING_SOURCES)[number];

export function assertMeetingSource(value: string): MeetingSource {
  if ((MEETING_SOURCES as readonly string[]).includes(value)) {
    return value as MeetingSource;
  }
  throw new McpToolError(
    `Unknown meeting source '${value}'. Expected one of: ${MEETING_SOURCES.join(", ")}.`,
  );
}

/**
 * Fetch a provider meeting and prove the caller owns it.
 *
 * Note the provider tables store `user_id` as TEXT while `users.id` is
 * VARCHAR, so compare as strings rather than relying on a join.
 */
export async function assertMeetingAccess(
  userId: string,
  source: MeetingSource,
  meetingId: number,
): Promise<any> {
  let row: any;
  switch (source) {
    case "zoom":
      row = await storage.getZoomMeeting(meetingId);
      break;
    case "google_meet":
      row = await storage.getGoogleMeetMeeting(meetingId);
      break;
    case "teams":
      row = await storage.getTeamsMeeting(meetingId);
      break;
  }

  // Deliberately identical message for "missing" and "not yours" — a
  // different response for each would confirm the existence of other users'
  // rows to anyone probing ids.
  if (!row || String(row.userId) !== String(userId)) {
    throw new McpToolError(`No ${source} meeting found with id ${meetingId}.`);
  }
  return row;
}

export async function assertConversationAccess(
  userId: string,
  conversationId: number,
): Promise<any> {
  const row = await storage.getConversation(conversationId);
  if (!row || String(row.userId) !== String(userId)) {
    throw new McpToolError(`No conversation found with id ${conversationId}.`);
  }
  return row;
}

// ─────────────────────────────────────────────────────────────────────────
// Themes
// ─────────────────────────────────────────────────────────────────────────

export async function assertThemeAccess(userId: string, themeId: number): Promise<any> {
  const row = await storage.getTheme(themeId);
  if (!row || String(row.userId) !== String(userId)) {
    throw new McpToolError(`No theme found with id ${themeId}.`);
  }
  return row;
}

// ─────────────────────────────────────────────────────────────────────────
// Result shaping
// ─────────────────────────────────────────────────────────────────────────
//
// Pagination and truncation are correctness requirements here, not polish.
// A single unbounded transcript or mention list can be hundreds of KB — that
// overflows the model's context window AND bills the user for it in one call.

export const MAX_TEXT_CHARS = 20_000;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function clampLimit(limit: unknown, fallback = DEFAULT_PAGE_SIZE): number {
  const n = typeof limit === "number" && Number.isFinite(limit) ? Math.floor(limit) : fallback;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, n));
}

export function clampOffset(offset: unknown): number {
  const n = typeof offset === "number" && Number.isFinite(offset) ? Math.floor(offset) : 0;
  return Math.max(0, n);
}

export interface TextWindow {
  text: string;
  offset: number;
  returnedChars: number;
  totalChars: number;
  hasMore: boolean;
  nextOffset: number | null;
}

/**
 * Return a bounded window over a long string, plus the metadata a model needs
 * to decide whether to ask for the next page.
 */
export function windowText(
  full: string | null | undefined,
  offset: unknown,
  limit?: unknown,
): TextWindow {
  const source = full ?? "";
  const start = clampOffset(offset);
  const size =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(1, Math.min(MAX_TEXT_CHARS, Math.floor(limit)))
      : MAX_TEXT_CHARS;

  const slice = source.slice(start, start + size);
  const end = start + slice.length;
  const hasMore = end < source.length;

  return {
    text: slice,
    offset: start,
    returnedChars: slice.length,
    totalChars: source.length,
    hasMore,
    nextOffset: hasMore ? end : null,
  };
}

export interface Page<T> {
  items: T[];
  offset: number;
  returned: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export function paginate<T>(items: T[], offset: unknown, limit: unknown): Page<T> {
  const start = clampOffset(offset);
  const size = clampLimit(limit);
  const slice = items.slice(start, start + size);
  const end = start + slice.length;
  const hasMore = end < items.length;

  return {
    items: slice,
    offset: start,
    returned: slice.length,
    total: items.length,
    hasMore,
    nextOffset: hasMore ? end : null,
  };
}
