/**
 * Self-applying MCP schema.
 *
 * So a deployment needs only the CODE — no manual `psql` step. The migration
 * is entirely `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so
 * running it on every boot is safe and idempotent: it creates the four MCP
 * tables the first time and does nothing thereafter.
 *
 * The SQL lives in scripts/create-mcp-tables.sql (single source of truth,
 * also runnable by hand). We read and execute that file rather than
 * duplicating the DDL here, so the two can never drift.
 *
 * Failure is non-fatal: if this can't run (file missing in a trimmed bundle,
 * transient DB issue), we log and continue. The MCP features that need the
 * tables will surface a clear error later; the rest of the app is unaffected.
 */

import fs from "fs";
import path from "path";
import { pool } from "../db";

export async function ensureMcpSchema(): Promise<void> {
  const candidates = [
    path.join(process.cwd(), "scripts", "create-mcp-tables.sql"),
    path.join(process.cwd(), "..", "scripts", "create-mcp-tables.sql"),
  ];

  const sqlPath = candidates.find((p) => fs.existsSync(p));
  if (!sqlPath) {
    console.warn(
      "⚠️  MCP auto-migrate: scripts/create-mcp-tables.sql not found — " +
        "skipping. If MCP tables are missing, run the migration by hand.",
    );
    return;
  }

  const sql = fs.readFileSync(sqlPath, "utf8");

  // Whole file in one transaction: either every statement applies or none does,
  // so a half-applied schema can't result from an interrupted boot.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("✅ MCP schema: ensured (tables auto-created if missing)");
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    // Non-fatal — see file header.
    console.error(
      "⚠️  MCP auto-migrate failed (continuing without it):",
      err?.message || err,
    );
  } finally {
    client.release();
  }
}
