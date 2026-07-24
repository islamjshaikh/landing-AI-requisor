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

export const pool = new Pool({
  connectionString: sslEnabledUrl,
  ssl: sslDisabled ? false : {
    rejectUnauthorized: false // Allow self-signed certificates for cloud providers
  },
  // Connection pool limits to prevent "too many connections" errors
  max: 10, // Maximum 10 connections in the pool
  min: 1,  // Keep at least 1 connection alive
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Wait 5 seconds for connection
  statement_timeout: 30000, // 30 second statement timeout
  query_timeout: 30000 // 30 second query timeout
});

export const db = drizzle(pool, { schema });
