import { db, pool } from "./db";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

export async function setupDatabase() {
  try {
    console.log("Setting up database tables...");

    // Create session table
    const createSessionsTableSQL = `
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(255) PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `;
    await db.execute(createSessionsTableSQL);

    // Create index on sessions.expire
    const createSessionsIndexSQL = `
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire)
    `;
    await db.execute(createSessionsIndexSQL);

    // Create users table
    const createUsersTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        bio TEXT,
        profile_image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await db.execute(createUsersTableSQL);

    // Create projects table
    const createProjectsTableSQL = `
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        due_date TIMESTAMP,
        status TEXT DEFAULT 'active',
        progress INTEGER DEFAULT 0,
        total_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        icon TEXT DEFAULT 'folder-open',
        icon_bg TEXT DEFAULT 'blue',
        created_at TIMESTAMP DEFAULT NOW(),
        owner_id VARCHAR(255) REFERENCES users(id),
        external_id TEXT,
        source TEXT DEFAULT 'manual',
        source_data JSONB,
        ai_generated BOOLEAN DEFAULT FALSE
      )
    `;
    await db.execute(createProjectsTableSQL);

    // Create tasks table
    const createTasksTableSQL = `
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo',
        is_completed BOOLEAN DEFAULT FALSE,
        due_date TIMESTAMP,
        priority TEXT DEFAULT 'medium',
        assignee_id VARCHAR(255) REFERENCES users(id),
        project_id INTEGER REFERENCES projects(id),
        parent_task_id INTEGER REFERENCES tasks(id),
        external_id TEXT,
        source TEXT DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await db.execute(createTasksTableSQL);

    // Create integrations table
    const createIntegrationsTableSQL = `
      CREATE TABLE IF NOT EXISTS integrations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id),
        provider TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expiry TIMESTAMP,
        is_connected BOOLEAN DEFAULT FALSE,
        last_synced TIMESTAMP,
        workspace_id TEXT,
        additional_data JSONB
      )
    `;
    await db.execute(createIntegrationsTableSQL);

    // Create insights table
    const createInsightsTableSQL = `
      CREATE TABLE IF NOT EXISTS insights (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        project_id INTEGER REFERENCES projects(id),
        created_at TIMESTAMP DEFAULT NOW(),
        is_resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP,
        suggested_action TEXT
      )
    `;
    await db.execute(createInsightsTableSQL);

    // Create project members table
    const createProjectMembersTableSQL = `
      CREATE TABLE IF NOT EXISTS project_members (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'viewer',
        added_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await db.execute(createProjectMembersTableSQL);

    // Create project invitations table
    const createProjectInvitationsTableSQL = `
      CREATE TABLE IF NOT EXISTS project_invitations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        token TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        invited_by VARCHAR(255) NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        accepted_at TIMESTAMP
      )
    `;
    await db.execute(createProjectInvitationsTableSQL);

    // Create kanban columns table
    const createKanbanColumnsTableSQL = `
      CREATE TABLE IF NOT EXISTS kanban_columns (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        color TEXT DEFAULT 'bg-slate-100',
        icon_name TEXT DEFAULT 'circle',
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await db.execute(createKanbanColumnsTableSQL);

    // Create AI tools table
    const createAiToolsTableSQL = `
      CREATE TABLE IF NOT EXISTS ai_tools (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        free_plan_available BOOLEAN DEFAULT FALSE,
        pricing TEXT,
        website TEXT NOT NULL,
        logo_url TEXT,
        use_case TEXT,
        ideal_for TEXT
      )
    `;
    await db.execute(createAiToolsTableSQL);

    // Create task tool recommendations table
    const createTaskToolRecommendationsTableSQL = `
      CREATE TABLE IF NOT EXISTS task_tool_recommendations (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tool_id INTEGER NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'suggested',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(task_id, tool_id)
      )
    `;
    await db.execute(createTaskToolRecommendationsTableSQL);

    // Enable pgvector extension
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      console.log("Vector extension enabled.");
    } catch (e) {
      console.warn("Could not enable vector extension. Vector features may not work:", e);
    }

    // Create chat embeddings table
    // 768 dimensions for gemini-1.5-flash text-embedding-004
    const createChatEmbeddingsTableSQL = `
      CREATE TABLE IF NOT EXISTS chat_embeddings (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(768),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    // Only attempt to create if vector extension succeeded/exists (handled by SQL usually, but good practice)
    try {
      await db.execute(createChatEmbeddingsTableSQL);
    } catch (e) {
      console.warn("Could not create chat_embeddings table (vector extension missing?):", e);
    }

    // Unified content embedding index (semantic search over imported content).
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS content_embeddings (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR NOT NULL,
          source_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL DEFAULT 0,
          content TEXT NOT NULL,
          embedding vector(768),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT content_embeddings_source_chunk_uq UNIQUE (user_id, source_type, source_id, chunk_index)
        )
      `);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS content_embeddings_user_source_idx ON content_embeddings (user_id, source_type)`,
      );
    } catch (e) {
      console.warn("Could not create content_embeddings table (vector extension missing?):", e);
    }

    // ── Recurring Theme Finder tables ────────────────────────────────────────
    // Created here idempotently so the schema is reproducible on a fresh DB.
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customer_tiers (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        company TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'standard',
        weight REAL NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS themes (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        mention_count INTEGER NOT NULL DEFAULT 0,
        distinct_source_count INTEGER NOT NULL DEFAULT 0,
        weighted_score REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        merged_into_id INTEGER,
        last_seen_at TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS theme_mentions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        theme_id INTEGER NOT NULL REFERENCES themes(id),
        quote TEXT NOT NULL,
        speaker TEXT,
        company TEXT,
        customer_tier TEXT NOT NULL DEFAULT 'standard',
        weight REAL NOT NULL DEFAULT 1,
        confidence REAL,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        source_label TEXT,
        timestamp_seconds INTEGER,
        timestamp_label TEXT,
        recording_url TEXT,
        deep_link TEXT,
        dedupe_key TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Backfill new columns on databases where the tables predate this migration.
    // The embedding column needs the vector extension; guard it separately.
    try {
      await db.execute(`ALTER TABLE themes ADD COLUMN IF NOT EXISTS embedding vector(768)`);
    } catch (e) {
      // No pgvector on this DB. Fall back to a plain text column so that
      // `SELECT ... embedding ... FROM themes` (Drizzle selects every schema
      // column) still works — semantic search then degrades to keyword. Without
      // this column the entire themes feature 500s on non-pgvector databases.
      console.warn("Could not add themes.embedding as vector(768) (pgvector missing); falling back to text:", e);
      try {
        await db.execute(`ALTER TABLE themes ADD COLUMN IF NOT EXISTS embedding text`);
      } catch (e2) {
        console.warn("Could not add themes.embedding text fallback:", e2);
      }
    }
    await db.execute(`ALTER TABLE themes ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP`);
    await db.execute(`ALTER TABLE theme_mentions ADD COLUMN IF NOT EXISTS confidence REAL`);

    // ── Theme Finder source tables ───────────────────────────────────────────
    // Imported conversations (Import Conversation: manual/audio/zoom/meet/teams)
    // and Teams meetings feed collectSourceDocuments(). Created idempotently so a
    // fresh DB can ingest them (and so their absence stops flooding logs).
    await db.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        content TEXT NOT NULL,
        summary TEXT,
        participants TEXT[] DEFAULT '{}',
        meeting_date TIMESTAMP,
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS teams_meetings (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        join_url TEXT,
        meeting_id TEXT,
        thread_id TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        transcript TEXT,
        project_plan JSONB,
        attendees TEXT[] DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const createEvidenceItemsTableSQL = `
      CREATE TABLE IF NOT EXISTS evidence_items (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'note',
        source_id INTEGER,
        tags TEXT[] DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await db.execute(createEvidenceItemsTableSQL);

    const addScoringColumnsSQL = `
      DO $$ BEGIN
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS impact_score INTEGER;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS effort_score INTEGER;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS confidence_score INTEGER;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS rice_score INTEGER;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS priority_rank INTEGER;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS score_reasoning JSONB;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS reasoning_chain TEXT;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS last_sent_to_agent TEXT;
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP;
        -- Structured evidence references — each entry pairs a verbatim
        -- quote with a back-link to the source transcript so users can
        -- click through to the meeting that produced the insight.
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS evidence_refs JSONB DEFAULT '[]'::jsonb;
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `;
    await db.execute(addScoringColumnsSQL);

    const addInsightTypeColumnSQL = `
      DO $$ BEGIN
        ALTER TABLE evidence_items ADD COLUMN IF NOT EXISTS insight_type TEXT;
        ALTER TABLE evidence_items ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 1;
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `;
    await db.execute(addInsightTypeColumnSQL);

    const addMentionCountToFeatureCandidatesSQL = `
      DO $$ BEGIN
        ALTER TABLE feature_candidates ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 1;
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `;
    await db.execute(addMentionCountToFeatureCandidatesSQL);

    const createDiscoveryReportsSQL = `
      CREATE TABLE IF NOT EXISTS discovery_reports (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        share_token TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        report_data JSONB NOT NULL,
        is_public BOOLEAN DEFAULT TRUE,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await db.execute(createDiscoveryReportsSQL);

    const createGoogleMeetMeetingsSQL = `
      CREATE TABLE IF NOT EXISTS google_meet_meetings (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        meet_link TEXT,
        calendar_event_id TEXT,
        organizer_email TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        transcript TEXT,
        recording_url TEXT,
        attendees TEXT[] DEFAULT '{}',
        meeting_code TEXT,
        transcript_doc_id TEXT,
        conference_record_id TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await db.execute(createGoogleMeetMeetingsSQL);

    try {
      await db.execute(`ALTER TABLE google_meet_meetings ADD COLUMN IF NOT EXISTS meeting_code TEXT`);
      await db.execute(`ALTER TABLE google_meet_meetings ADD COLUMN IF NOT EXISTS transcript_doc_id TEXT`);
      await db.execute(`ALTER TABLE google_meet_meetings ADD COLUMN IF NOT EXISTS conference_record_id TEXT`);
    } catch (e) {}

    const createOauthStatesSQL = `
      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        code_verifier TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await db.execute(createOauthStatesSQL);

    const createZoomMeetingsSQL = `
      CREATE TABLE IF NOT EXISTS zoom_meetings (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration INTEGER,
        join_url TEXT,
        start_url TEXT,
        zoom_meeting_id TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        transcript TEXT,
        recording_url TEXT,
        attendees TEXT[] DEFAULT '{}',
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await db.execute(createZoomMeetingsSQL);

    // AI Meeting Intelligence — bulk-transcript MOM processor outputs.
    const createMeetingIntelligenceSQL = `
      CREATE TABLE IF NOT EXISTS meeting_intelligence_documents (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        batch_id INTEGER,
        transcript_id TEXT NOT NULL,
        project_name TEXT,
        department TEXT,
        meeting_source TEXT NOT NULL,
        meeting_date TEXT,
        meeting_title TEXT,
        participants TEXT[] DEFAULT '{}',
        transcript_text TEXT NOT NULL,
        document_json JSONB,
        document_markdown TEXT,
        confidence_score REAL,
        status TEXT NOT NULL DEFAULT 'processing',
        error_message TEXT,
        chunk_count INTEGER DEFAULT 1,
        token_usage JSONB,
        claimed_at TIMESTAMP,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await db.execute(createMeetingIntelligenceSQL);
    // Forward-compatibility: add columns the worker needs if upgrading from
    // the pre-bulk schema. These are idempotent / no-ops on fresh installs.
    await db.execute(
      `ALTER TABLE meeting_intelligence_documents ADD COLUMN IF NOT EXISTS batch_id INTEGER`,
    );
    await db.execute(
      `ALTER TABLE meeting_intelligence_documents ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP`,
    );
    await db.execute(
      `ALTER TABLE meeting_intelligence_documents ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_meeting_intel_user_created
       ON meeting_intelligence_documents (user_id, created_at DESC)`,
    );
    // The worker filters by status='queued' on every tick; index speeds that
    // up + supports FOR UPDATE SKIP LOCKED claim queries.
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_meeting_intel_queue
       ON meeting_intelligence_documents (status, created_at)
       WHERE status = 'queued'`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_meeting_intel_batch
       ON meeting_intelligence_documents (batch_id)
       WHERE batch_id IS NOT NULL`,
    );

    // Batches table (groups of transcripts submitted together).
    await db.execute(`
      CREATE TABLE IF NOT EXISTS meeting_intelligence_batches (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        label TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        total_count INTEGER NOT NULL DEFAULT 0,
        completed_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_meeting_intel_batches_user_created
       ON meeting_intelligence_batches (user_id, created_at DESC)`,
    );

    const createTokenUsageSQL = `
      CREATE TABLE IF NOT EXISTS token_usage (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        feature TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost TEXT NOT NULL DEFAULT '0',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await db.execute(createTokenUsageSQL);

    const createTokenBudgetsSQL = `
      CREATE TABLE IF NOT EXISTS token_budgets (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL UNIQUE,
        monthly_limit INTEGER NOT NULL DEFAULT 5000,
        tokens_used_this_month INTEGER NOT NULL DEFAULT 0,
        reset_date TIMESTAMP NOT NULL,
        last_warning_at TIMESTAMP,
        degraded_mode BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await db.execute(createTokenBudgetsSQL);

    try {
      await db.execute(`UPDATE subscription_plans SET max_projects = 1 WHERE slug = 'free' AND max_projects > 1`);
      await db.execute(`
        UPDATE token_budgets SET monthly_limit = 5000
        WHERE user_id IN (
          SELECT u.id FROM users u
          LEFT JOIN subscription_plans sp ON u.plan_id = sp.id
          WHERE sp.slug = 'free' OR sp.slug IS NULL
        ) AND monthly_limit > 5000
      `);

      await db.execute(`
        UPDATE token_budgets tb SET monthly_limit = CASE
          WHEN sp.slug = 'pro' THEN 1000000
          WHEN sp.slug = 'business' THEN 10000000
          WHEN sp.slug = 'enterprise' THEN 20000000
          ELSE 5000
        END
        FROM users u
        JOIN subscription_plans sp ON u.plan_id = sp.id
        WHERE tb.user_id = u.id
        AND sp.slug IN ('pro', 'business', 'enterprise')
        AND tb.monthly_limit != CASE
          WHEN sp.slug = 'pro' THEN 1000000
          WHEN sp.slug = 'business' THEN 10000000
          WHEN sp.slug = 'enterprise' THEN 20000000
          ELSE 5000
        END
      `);

      // Hard-coded auto-promotion of a specific email to a paid plan was a
      // privilege-escalation backdoor — it gave whoever controlled that
      // mailbox a guaranteed Pro account on every fresh deployment. Removed.
      // If a particular user needs to be seeded into a plan, set ADMIN_EMAIL
      // and PROMOTE_PLAN_SLUG environment variables explicitly.
      const adminEmail = process.env.ADMIN_EMAIL;
      const promoteSlug = process.env.PROMOTE_PLAN_SLUG;
      if (adminEmail && promoteSlug) {
        try {
          const planRow = await pool.query(
            `SELECT id FROM subscription_plans WHERE slug = $1 LIMIT 1`,
            [promoteSlug],
          );
          if (planRow.rows.length > 0) {
            const planId = planRow.rows[0].id;
            await pool.query(
              `UPDATE users SET plan_id = $1 WHERE email = $2 AND (plan_id IS NULL OR plan_id = 1)`,
              [planId, adminEmail],
            );
            console.log(`[DB Setup] Synced ${adminEmail} to ${promoteSlug} plan if needed`);
          }
        } catch (err) {
          console.error("[DB Setup] Admin plan promotion failed:", err);
        }
      }
    } catch (e) {
    }

    try {
      await db.execute(`
        INSERT INTO subscription_plans (name, slug, description, price, currency, billing_interval, features, max_users, max_projects, is_active, sort_order)
        SELECT 'Business', 'business', 'For growing teams and agencies', 9900, 'USD', 'month',
          ARRAY['unlimited_projects','advanced_ai','integrations','team_collaboration','priority_support'], 50, 200, true, 3
        WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE slug = 'business')
      `);
      await db.execute(`
        INSERT INTO subscription_plans (name, slug, description, price, currency, billing_interval, features, max_users, max_projects, is_active, sort_order)
        SELECT 'Enterprise', 'enterprise', 'For large organizations with custom needs', 29900, 'USD', 'month',
          ARRAY['unlimited_projects','advanced_ai','integrations','team_collaboration','priority_support','sso','custom_integrations'], 500, 1000, true, 4
        WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE slug = 'enterprise')
      `);
      await db.execute(`
        UPDATE subscription_plans SET max_projects = 50, max_users = 10 WHERE slug = 'pro' AND max_projects < 50
      `);
      await db.execute(`
        UPDATE subscription_plans SET max_projects = 200, max_users = 50 WHERE slug = 'business' AND max_projects < 200
      `);
      await db.execute(`
        UPDATE subscription_plans SET max_projects = 1000, max_users = 500 WHERE slug = 'enterprise' AND max_projects < 1000
      `);
    } catch (e) {
    }

    // Per-user AI provider settings (BYO Claude key). Created deterministically
    // here so BYOK routing works on any environment without a manual migration.
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_ai_settings (
          user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          provider VARCHAR NOT NULL DEFAULT 'platform',
          anthropic_api_key_encrypted TEXT,
          anthropic_key_last4 VARCHAR(4),
          transcription_api_key_encrypted TEXT,
          transcription_key_last4 VARCHAR(4),
          zero_retention BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (e) {
      console.error("[DB Setup] user_ai_settings table creation failed:", e);
    }

    console.log("Database setup complete.");
    return true;
  } catch (error) {
    console.error("Error setting up database:", error);
    return false;
  }
}
