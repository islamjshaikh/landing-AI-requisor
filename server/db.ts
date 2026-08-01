import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Ensure SSL is enabled for secure connections
const databaseUrl = process.env.DATABASE_URL;
const sslDisabled = /sslmode=disable/i.test(databaseUrl);
const sslEnabledUrl = sslDisabled || databaseUrl.includes('sslmode=')
  ? databaseUrl
  : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require`;

// Pool tuned for a SERVERLESS Postgres (Neon). Neon suspends compute when idle
// and closes idle connections on its side, which caused the recurring
// "Connection terminated due to connection timeout" and "terminated
// unexpectedly" errors in production. The settings below address each cause.
export const pool = new Pool({
  connectionString: sslEnabledUrl,
  ssl: sslDisabled ? false : {
    rejectUnauthorized: false // Allow self-signed certificates for cloud providers
  },
  max: 10, // Maximum connections in the pool

  // Do NOT hold connections open to a scale-to-zero database. Keeping a
  // minimum alive means pg hands out connections Neon has already closed on
  // its side → "terminated unexpectedly". Let the pool drain to zero when idle.
  min: 0,

  // Close our idle connections quickly — before Neon does — so we never reuse
  // one Neon has silently dropped. (Was 30s, longer than needed and prone to
  // going stale.)
  idleTimeoutMillis: 10000,

  // Neon cold-starts can exceed 5s. Give a suspended compute time to wake
  // instead of failing the very first query after an idle period. (Was 5000 —
  // the direct cause of the "connection timeout" errors.)
  connectionTimeoutMillis: 20000,

  // Recycle a connection after this many uses so a long-lived socket can't
  // quietly go stale and fail mid-query.
  maxUses: 7500,

  // TCP keepalive detects a dead connection proactively rather than on the
  // next query. Helps notice Neon-side drops early.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  statement_timeout: 30000, // 30 second statement timeout
  query_timeout: 30000, // 30 second query timeout
});

// CRITICAL: without this handler, an error on an IDLE pooled client (e.g. Neon
// closing a connection while it sits in the pool) is emitted as an unhandled
// 'error' event on the Pool — which can crash the whole process. Here we log
// it and let the pool discard the bad client; the next request gets a fresh
// connection. This is what turns a hard crash into a self-healing blip.
pool.on("error", (err) => {
  console.error("[db] idle client error (pool will recover):", err?.message || err);
});

export const db = drizzle(pool, { schema });
