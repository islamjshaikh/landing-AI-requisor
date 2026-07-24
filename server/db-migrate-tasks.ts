import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrateTaskTables() {
  try {
    console.log("Starting task tables migration...");

    // Create task_comments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        parent_comment_id INTEGER REFERENCES task_comments(id) ON DELETE CASCADE,
        is_edited BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✓ Created task_comments table");

    // Create task_attachments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS task_attachments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        upload_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✓ Created task_attachments table");

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateTaskTables();