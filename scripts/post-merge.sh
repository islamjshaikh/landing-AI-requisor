#!/bin/bash
set -e

npm install

# NOTE: Do NOT run `npm run db:push` here. This repo has intentional drift:
# some tables (oauth_states, verification_tokens, ...) are created by raw SQL
# in server/db-setup.ts and are absent from shared/schema.ts, so drizzle-kit
# push prompts interactively (stdin is closed here) and would try to drop
# live tables if forced. New tables/columns are applied via direct SQL by the
# task that introduces them; server/db-setup.ts also runs idempotently on boot.
