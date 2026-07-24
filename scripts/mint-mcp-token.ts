/**
 * Mint an MCP access token from the command line.
 *
 * The Settings UI is the normal path, but that needs a browser session. This
 * is for local testing and for scripted setup.
 *
 * Usage:
 *   npx tsx scripts/mint-mcp-token.ts <userIdOrEmail> [token name]
 *
 * Examples:
 *   npx tsx scripts/mint-mcp-token.ts you@example.com
 *   npx tsx scripts/mint-mcp-token.ts u_abc123 "Inspector - local"
 *
 * Requires DATABASE_URL (loaded from .env) and the user_api_tokens table:
 *   psql "$DATABASE_URL" -f scripts/create-mcp-tables.sql
 *
 * The token is printed once. It is stored as a SHA-256 hash, so it cannot be
 * recovered afterwards — copy it immediately.
 */

import "dotenv/config";

async function main() {
  const [identifier, ...nameParts] = process.argv.slice(2);

  if (!identifier) {
    console.error(
      "Usage: npx tsx scripts/mint-mcp-token.ts <userIdOrEmail> [token name]",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Add it to .env and retry.");
    process.exit(1);
  }

  // Imported dynamically so the DATABASE_URL check above runs first — db.ts
  // throws at module load when it is missing.
  const { db } = await import("../server/db");
  const { users } = await import("@shared/schema");
  const { issueToken } = await import("../server/services/api-tokens");
  const { eq, or } = await import("drizzle-orm");

  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(or(eq(users.id, identifier), eq(users.email, identifier)))
    .limit(1);

  const user = rows[0];
  if (!user) {
    console.error(`No user found matching "${identifier}".`);
    process.exit(1);
  }

  const name = nameParts.join(" ").trim() || "CLI-minted token";
  const { token, record } = await issueToken({
    userId: user.id,
    name,
    scopes: ["read"],
  });

  // APP_DOMAIN may already carry a scheme (it does in .env.example), so only
  // prepend one when it doesn't.
  const domain = process.env.APP_DOMAIN;
  const base = domain
    ? /^https?:\/\//.test(domain)
      ? domain
      : `${process.env.APP_PROTOCOL || "https"}://${domain}`
    : `http://localhost:${process.env.PORT || 5000}`;

  console.log(`
Token minted for ${user.email || user.id}
  name:   ${record.name}
  scopes: ${record.scopes.join(", ")}

  ${token}

Copy it now — it is stored hashed and cannot be shown again.

Test it with the MCP Inspector:
  npx @modelcontextprotocol/inspector
  URL:    ${base}/api/mcp
  Header: Authorization: Bearer <token above>

Or from Claude Code:
  claude mcp add --transport http requisor ${base}/api/mcp \\
    --header "Authorization: Bearer <token above>"
`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to mint token:", err?.message || err);
  process.exit(1);
});
