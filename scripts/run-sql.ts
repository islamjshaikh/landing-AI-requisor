/**
 * Run a .sql file against DATABASE_URL without needing psql installed.
 *
 * Uses the `pg` driver the app already depends on, so this works anywhere
 * Node runs — including Windows, where psql usually isn't on PATH.
 *
 * Usage:
 *   npx tsx scripts/run-sql.ts scripts/create-mcp-tables.sql
 *
 * The whole file runs inside a transaction: if any statement fails, nothing
 * is applied. Re-running is safe as long as the SQL is idempotent
 * (create-mcp-tables.sql uses IF NOT EXISTS throughout).
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/run-sql.ts <path-to.sql>");
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set.\n" +
        "Add it to .env — copy it from Replit → Secrets → DATABASE_URL.",
    );
    process.exit(1);
  }

  const sql = fs.readFileSync(fullPath, "utf8");

  // Match server/db.ts: Neon and most managed Postgres require TLS, and use
  // certificates Node won't verify against its default trust store.
  const sslDisabled = /sslmode=disable/i.test(databaseUrl);
  const pool = new Pool({
    connectionString: sslDisabled
      ? databaseUrl
      : databaseUrl.includes("sslmode=")
        ? databaseUrl
        : `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}sslmode=require`,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  try {
    // Redact credentials before echoing the target back to the user.
    const host = (() => {
      try {
        return new URL(databaseUrl).host;
      } catch {
        return "(unparseable host)";
      }
    })();
    console.log(`\nRunning ${path.basename(fullPath)} against ${host}\n`);

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Applied successfully.\n");
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`\nFailed — nothing was applied.\n  ${err?.message || err}\n`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err?.message || err);
  process.exit(1);
});
