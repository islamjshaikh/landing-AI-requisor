/**
 * Local session-based authentication.
 *
 * Replaces the previous Replit OIDC implementation in server/replitAuth.ts.
 * The custom email/password flow at /api/auth/{register,login,...} populates
 * the passport session via `req.login(sessionUser, ...)` — `setupAuth` here
 * just boots passport + Postgres-backed sessions, and `isAuthenticated` is a
 * minimal middleware that checks the session and (optionally) the
 * `expires_at` claim attached by the custom auth flow.
 *
 * No OIDC discovery, no third-party identity provider.
 */

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import "express-session";
import connectPg from "connect-pg-simple";
import crypto from "crypto";

export function getSession() {
  // 7-day sliding session. Long-lived sessions amplify cookie-theft impact;
  // sliding refresh keeps active users signed in without forcing yearly logins.
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;

  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET;

  // Fail fast in production — silently using a hard-coded fallback would
  // mean every signed cookie is forgeable.
  if (!sessionSecret || sessionSecret.length < 32) {
    if (isProduction) {
      throw new Error(
        "SESSION_SECRET must be set to a random 32+ character string in production",
      );
    }
    console.warn(
      "[security] SESSION_SECRET is missing or weak. Using a per-process random fallback for development only.",
    );
  }

  const effectiveSecret =
    sessionSecret && sessionSecret.length >= 32
      ? sessionSecret
      : crypto.randomBytes(48).toString("hex");

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl / 1000, // connect-pg-simple expects seconds
    tableName: "sessions",
  });

  return session({
    secret: effectiveSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express): Promise<void> {
  // Trust proxy is set by the caller in server/index.ts.
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Custom auth uses a plain object as the session user — store it as-is.
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Generic logout endpoint. The custom auth flow already exposes
  // /api/auth/logout via routes.ts; this /api/logout is preserved for any
  // legacy clients still calling it (the previous Replit OIDC flow used it).
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });
}

/**
 * Minimal session-based auth gate. Accepts any request whose session has a
 * user populated by `req.login(...)`. Honours an `expires_at` claim on the
 * session user when present (the custom auth flow sets this) so stale
 * sessions are still rejected without needing an external IdP for refresh.
 */
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ message: "Not authenticated - Please log in" });
  }

  const user = req.user as any;
  if (!user || !user.claims) {
    return res.status(401).json({ message: "Invalid session data" });
  }

  // If the session user carries an explicit expiry, enforce it. Sessions
  // without an expiry rely on the cookie's own maxAge for invalidation.
  if (user.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (now > user.expires_at) {
      return req.logout(() => {
        return res
          .status(401)
          .json({ message: "Session expired - Please log in again" });
      });
    }
  }

  return next();
};
