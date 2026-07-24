/**
 * Rate-limiting middleware for sensitive endpoints.
 *
 * Why: prevents credential stuffing, password-reset spam, and brute-force
 * enumeration. Limits are per-IP. Production deployments behind a proxy must
 * also enable `app.set("trust proxy", 1)` (already done in index.ts) so that
 * X-Forwarded-For is honoured.
 */

import rateLimit, { type Options } from "express-rate-limit";

const baseConfig: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Skip rate limiting only for health checks
  skip: (req) => req.path === "/api/health",
};

/** 5 login attempts per 15 minutes per IP. */
export const loginLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error:
      "Too many login attempts from this IP. Please wait 15 minutes and try again.",
  },
});

/** 3 registrations per hour per IP. */
export const registerLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many accounts created from this IP. Try again later." },
});

/** 3 password-reset / verification-resend requests per hour per IP. */
export const sensitiveAuthLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many requests. Try again later." },
});

/** General API limiter — 100 req/min/IP. Applied to public-facing AI routes. */
export const apiLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Slow down." },
});

/**
 * MCP endpoint limiter — 240 req/min/IP.
 *
 * Higher than apiLimiter because an agent legitimately fans out: one user
 * question can become a dozen tool calls, and paginated reads multiply that
 * again. Still bounded, because a retry loop in a misbehaving client would
 * otherwise hammer the database unattended.
 *
 * Note this is per-IP, not per-token, so several users behind one office NAT
 * share the budget. Move to a token-keyed limiter if that becomes a problem.
 */
export const mcpLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: 240,
  message: {
    jsonrpc: "2.0",
    error: { code: -32000, message: "Rate limit exceeded. Slow down." },
    id: null,
  },
});

/** 10 token mint/revoke operations per hour per IP. */
export const tokenManagementLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many token operations. Try again later." },
});
